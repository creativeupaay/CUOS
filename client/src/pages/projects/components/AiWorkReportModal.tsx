import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Sparkles, 
    X, 
    Calendar, 
    Clock, 
    Layers, 
    TrendingUp, 
    CheckCircle2, 
    AlertTriangle, 
    AlertCircle,
    Info,
    Lightbulb, 
    RefreshCw, 
    User, 
    ShieldCheck, 
    CalendarDays,
    FileText,
    Download
} from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { AiWorkReportPDF } from './AiWorkReportPDF';
import type { AiWorkReport } from '@/features/project/types/types';

interface AiWorkReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: AiWorkReport | null;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

export const AiWorkReportModal: React.FC<AiWorkReportModalProps> = ({
    isOpen,
    onClose,
    report,
    isLoading,
    error,
    onRetry,
}) => {
    // Close on ESC key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
            style={{ backgroundColor: 'rgba(15, 28, 20, 0.45)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-4xl my-auto flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden"
                style={{ maxHeight: '90vh', minHeight: '480px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── Modal Header ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-xs">
                            <Sparkles size={20} className={isLoading ? "animate-spin" : ""} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight font-['Outfit']">
                                    AI Work Review Report
                                </h2>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                    {report?.meta?.source === 'analytics' ? 'CUOS Intelligence' : 'Gemini AI'}
                                </span>
                                {report?.meta?.source === 'cache' && (
                                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                        ⚡ Cached
                                    </span>
                                )}
                            </div>
                            {report?.meta && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                                        <User size={13} className="text-gray-400" /> {report.meta.employeeName}
                                    </span>
                                    {report.meta.designation && <span className="text-gray-400">• {report.meta.designation}</span>}
                                    <span className="text-gray-300">•</span>
                                    <span className="flex items-center gap-1 text-gray-500">
                                        <Calendar size={13} className="text-gray-400" /> {report.meta.startDate} to {report.meta.endDate}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50/70 px-2 py-0.5 rounded-md">
                                        <Clock size={12} className="text-emerald-600" /> {report.meta.totalTrackedTime} Tracked
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Single Clean Close Button in Header */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ─── Modal Body ──────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 bg-[#FAFCFB]">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                                <Sparkles size={26} className="animate-spin" />
                            </div>
                            <div className="space-y-1.5">
                                <h3 className="text-base font-bold text-gray-900 font-['Outfit']">
                                    Analyzing Work & Preparing Review...
                                </h3>
                                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                                    Reviewing logged hours, completed deliverables, task consistency, and progress comparison.
                                </p>
                            </div>

                            {/* Progress steps */}
                            <div className="w-full max-w-sm bg-white p-4.5 rounded-xl border border-gray-200/80 shadow-xs space-y-2.5 text-left text-xs">
                                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                                    <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                                    <span>Checking task consistency and audit signals</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                    <span>Comparing progress with previous period</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                    <span>Organizing key milestones and workstreams</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="space-y-1 max-w-md">
                                <h3 className="text-base font-bold text-gray-900 font-['Outfit']">
                                    Unable to Generate AI Report
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    {error}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={onRetry}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
                                >
                                    <RefreshCw size={13} /> Try Again
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loaded Report Content */}
                    {!isLoading && !error && report && (
                        <>
                            {/* ── 1. Unified Executive Review Card ──────────── */}
                            <div className="bg-white rounded-xl p-5 sm:p-6 border border-emerald-100 shadow-xs border-l-4 border-l-emerald-500 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 font-['Outfit']">
                                        <FileText size={15} className="text-emerald-600" />
                                        <span>Executive Summary & Work Review</span>
                                    </div>
                                    {report.workAudit && (
                                        <div>
                                            {report.workAudit.overallHealth === 'healthy' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 size={12} className="text-emerald-600" />
                                                    {report.workAudit.healthScoreLabel || 'Clean Record & On Track'}
                                                </span>
                                            ) : report.workAudit.overallHealth === 'flagged' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <AlertTriangle size={12} className="text-rose-600" />
                                                    {report.workAudit.healthScoreLabel || 'Review Recommended'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                    <AlertCircle size={12} className="text-amber-600" />
                                                    {report.workAudit.healthScoreLabel || 'Attention Needed'}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <p className="text-sm sm:text-[14.5px] text-gray-900 font-normal leading-relaxed">
                                    {report.executiveSummary || report.managerSummary || report.overview}
                                </p>

                                {/* Quick Performance Stat Pills */}
                                <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-700 font-medium">
                                        <Clock size={12} className="text-emerald-600" />
                                        <span className="font-semibold text-gray-900">{report.meta.totalTrackedTime}</span> Tracked
                                    </span>
                                    {report.periodComparison && (
                                        <>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-700 font-medium">
                                                <Calendar size={12} className="text-emerald-600" />
                                                <span className="font-semibold text-gray-900">{report.periodComparison.currentActiveDays}</span> Active Days
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-700 font-medium">
                                                <CheckCircle2 size={12} className="text-emerald-600" />
                                                <span className="font-semibold text-gray-900">{report.periodComparison.currentCompletedTasks}</span> Completed
                                            </span>
                                        </>
                                    )}
                                    {report.workstreams && report.workstreams[0] && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-800 font-medium">
                                            <Layers size={12} className="text-emerald-600" />
                                            Primary Focus: <span className="font-semibold">{report.workstreams[0].name}</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── 2. Period-over-Period Velocity & Progress Trend ──────────── */}
                            {report.periodComparison && (
                                <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200/80 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={15} className="text-emerald-600" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 font-['Outfit']">
                                                Progress & Performance Comparison
                                            </h3>
                                        </div>
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                            {report.periodComparison.periodLabel}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                        {/* Time comparison */}
                                        <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-200/70 space-y-1">
                                            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                                Tracked Time
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-base sm:text-lg font-bold text-gray-900 font-['Outfit']">
                                                    {report.periodComparison.currentTimeFormatted}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    report.periodComparison.timeChangeDirection === 'increase'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : report.periodComparison.timeChangeDirection === 'decrease'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {report.periodComparison.timeChangeDirection === 'increase' ? '+' : ''}
                                                    {report.periodComparison.timeChangePercentage}%
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                Prior: {report.periodComparison.previousTimeFormatted}
                                            </div>
                                        </div>

                                        {/* Tasks completed comparison */}
                                        <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-200/70 space-y-1">
                                            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                                Tasks Completed
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-base sm:text-lg font-bold text-gray-900 font-['Outfit']">
                                                    {report.periodComparison.currentCompletedTasks}
                                                </span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    report.periodComparison.completedTasksChange > 0
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : report.periodComparison.completedTasksChange < 0
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {report.periodComparison.completedTasksChange > 0 ? `+${report.periodComparison.completedTasksChange}` : report.periodComparison.completedTasksChange} vs prior
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                Prior: {report.periodComparison.previousCompletedTasks} completed
                                            </div>
                                        </div>

                                        {/* Active Days */}
                                        <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-200/70 space-y-1">
                                            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                                                Working Days
                                            </div>
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-base sm:text-lg font-bold text-gray-900 font-['Outfit']">
                                                    {report.periodComparison.currentActiveDays} days
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                                                    Prior: {report.periodComparison.previousActiveDays} days
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                Days with active work logged
                                            </div>
                                        </div>
                                    </div>

                                    {report.periodComparison.velocitySummary && (
                                        <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 leading-relaxed flex items-start gap-2">
                                            <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                                            <span>{report.periodComparison.velocitySummary}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── 3. Work Integrity & Activity Audit Signals ─────── */}
                            {report.workAudit && (
                                <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200/80 shadow-xs space-y-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={16} className={report.workAudit.overallHealth === 'healthy' ? "text-emerald-600" : "text-amber-600"} />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 font-['Outfit']">
                                                Work Quality & Integrity Review
                                            </h3>
                                        </div>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                            report.workAudit.overallHealth === 'healthy'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : report.workAudit.overallHealth === 'flagged'
                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}>
                                            {report.workAudit.healthScoreLabel}
                                        </span>
                                    </div>

                                    {report.workAudit.summary && (
                                        <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed">
                                            {report.workAudit.summary}
                                        </p>
                                    )}

                                    <div className="space-y-2.5 pt-1">
                                        {report.workAudit.signals.map((signal, sIdx) => {
                                            const isFlag = signal.severity === 'flag';
                                            const isWarning = signal.severity === 'warning';
                                            const isPositive = signal.severity === 'positive';

                                            return (
                                                <div 
                                                    key={sIdx}
                                                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                                                        isFlag 
                                                            ? 'bg-rose-50/40 border-rose-200 text-rose-950'
                                                            : isWarning
                                                            ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                                                            : isPositive
                                                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                                                            : 'bg-gray-50 border-gray-200 text-gray-900'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 font-bold font-['Outfit']">
                                                            {isFlag ? (
                                                                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                                            ) : isWarning ? (
                                                                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                                                            ) : isPositive ? (
                                                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                                            ) : (
                                                                <Info size={14} className="text-blue-600 shrink-0" />
                                                            )}
                                                            <span className="text-xs sm:text-[13px]">{signal.title}</span>
                                                        </div>
                                                        {signal.impact && (
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                                isFlag ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {signal.impact}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-xs leading-relaxed text-gray-700">
                                                        {signal.description}
                                                    </p>

                                                    {signal.relatedTasks && signal.relatedTasks.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {signal.relatedTasks.map((tName, tIdx) => (
                                                                <span 
                                                                    key={tIdx}
                                                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-white border border-gray-200 text-gray-700 shadow-2xs"
                                                                >
                                                                    {tName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── 4. Chronological Work Progression ─────────────── */}
                            {report.workProgression && report.workProgression.length > 0 && (
                                <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200/80 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={15} className="text-emerald-600" />
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 font-['Outfit']">
                                                Work Timeline & Milestones
                                            </h3>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            Timeline of key milestones and tasks completed
                                        </span>
                                    </div>

                                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
                                        {report.workProgression.map((wp: any, idx: number) => {
                                            const stepNum = idx + 1;
                                            const title = wp.stageTitle || wp.title || `Stage ${stepNum}`;
                                            const dateRange = wp.dateRange || `Phase ${stepNum}`;

                                            return (
                                                <div key={idx} className="relative space-y-2">
                                                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                                                        {stepNum}
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-mono">
                                                                {dateRange}
                                                            </span>
                                                            <h4 className="font-bold text-gray-900 text-xs sm:text-sm font-['Outfit']">
                                                                {title}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {wp.timeSpent && (
                                                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded">
                                                                    {wp.timeSpent}
                                                                </span>
                                                            )}
                                                            {wp.status && (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                                    wp.status === 'completed'
                                                                        ? 'bg-emerald-100 text-emerald-800'
                                                                        : 'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                    {wp.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed">
                                                        {wp.description}
                                                    </p>

                                                    {wp.tasksInvolved && wp.tasksInvolved.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                            {wp.tasksInvolved.map((tName: string, tIdx: number) => (
                                                                <span 
                                                                    key={tIdx} 
                                                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700"
                                                                >
                                                                    {tName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* ── 5. Synthesized Workstreams ──────────────────────── */}
                            {report.workstreams && report.workstreams.length > 0 && (
                                <div className="space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2 font-['Outfit']">
                                            <Layers size={15} className="text-emerald-600" />
                                            <span>Key Workstreams ({report.workstreams.length})</span>
                                        </h3>
                                        <span className="text-xs text-gray-400 font-normal">
                                            Tasks grouped by project and focus area
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {report.workstreams.map((ws, i) => (
                                            <div 
                                                key={i} 
                                                className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-xs hover:border-emerald-200 transition-all space-y-3"
                                            >
                                                {/* Workstream Header */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                                        <h4 className="text-sm sm:text-base font-bold text-gray-900 font-['Outfit']">
                                                            {ws.name}
                                                        </h4>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                                            <Clock size={11} /> {ws.totalTime}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                            <CalendarDays size={11} /> {ws.activeDays} {ws.activeDays === 1 ? 'active day' : 'active days'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Summary description */}
                                                <p className="text-xs sm:text-[13.5px] text-gray-700 leading-relaxed">
                                                    {ws.summary}
                                                </p>

                                                {/* Covered Tasks Tags */}
                                                {ws.relatedTaskNames && ws.relatedTaskNames.length > 0 && (
                                                    <div className="pt-1 flex items-start gap-2 flex-wrap">
                                                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-0.5">
                                                            Included tasks:
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {ws.relatedTaskNames.map((tName, tIdx) => (
                                                                <span 
                                                                    key={tIdx} 
                                                                    className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100/90 text-gray-700 hover:bg-gray-200/80 transition-colors"
                                                                >
                                                                    {tName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Observation */}
                                                {ws.observation && (
                                                    <div className="flex items-start gap-2 pl-3 py-1.5 border-l-2 border-emerald-400 bg-emerald-50/40 rounded-r-md text-xs sm:text-[12.5px] text-emerald-900 leading-relaxed">
                                                        <Lightbulb size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                                                        <span>{ws.observation}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── 6. Multi-Day Work & Overdue Items ────────────────── */}
                            {((report.multiDayWork && report.multiDayWork.length > 0) || (report.overdueWork && report.overdueWork.length > 0)) && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Multi-Day Work */}
                                    {report.multiDayWork && report.multiDayWork.length > 0 && (
                                        <div className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-xs space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2 font-['Outfit']">
                                                <CalendarDays size={14} className="text-emerald-600" />
                                                <span>Multi-Day Tasks & Streams</span>
                                            </h3>
                                            <div className="space-y-3">
                                                {report.multiDayWork.map((md, idx) => (
                                                    <div key={idx} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0 space-y-1.5">
                                                        <div className="flex items-center justify-between text-xs sm:text-[13px]">
                                                            <span className="font-semibold text-gray-900 font-['Outfit']">{md.title}</span>
                                                            <span className="text-emerald-700 font-bold text-xs">{md.totalTime}</span>
                                                        </div>
                                                        <p className="text-gray-600 text-xs leading-relaxed">
                                                            {md.description}
                                                        </p>
                                                        {md.dates && md.dates.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 pt-0.5">
                                                                {md.dates.map((d, dIdx) => (
                                                                    <span key={dIdx} className="px-2 py-0.5 rounded text-[10.5px] bg-gray-100 text-gray-600 font-medium">
                                                                        {d}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Overdue Work */}
                                    {report.overdueWork && report.overdueWork.length > 0 && (
                                        <div className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-xs space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-2 font-['Outfit']">
                                                <AlertTriangle size={14} className="text-rose-600" />
                                                <span>Pending & Overdue Tasks</span>
                                            </h3>
                                            <div className="space-y-3">
                                                {report.overdueWork.map((ow, idx) => (
                                                    <div key={idx} className="p-3.5 rounded-lg bg-rose-50/40 border border-rose-100 text-xs space-y-1.5">
                                                        <div className="flex items-center justify-between font-semibold text-rose-950 font-['Outfit']">
                                                            <span>{ow.title}</span>
                                                            {ow.relatedWorkstream && (
                                                                <span className="text-[10px] font-normal text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                                                    {ow.relatedWorkstream}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-gray-700 text-xs leading-relaxed">{ow.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── 7. Constructive Recommendations ─────────────────── */}
                            {report.suggestions && report.suggestions.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 font-['Outfit']">
                                        <CheckCircle2 size={15} className="text-emerald-600" />
                                        <span>Key Recommendations ({report.suggestions.length})</span>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {report.suggestions.map((sug, idx) => (
                                            <div key={idx} className="bg-white rounded-xl p-4.5 border border-emerald-100 shadow-xs flex items-start gap-3.5">
                                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </span>
                                                <div className="space-y-1 flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-900 text-xs sm:text-[13.5px] font-['Outfit']">
                                                        {sug.title}
                                                    </h4>
                                                    <p className="text-gray-600 text-xs sm:text-[12.5px] leading-relaxed">
                                                        {sug.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer Stamp */}
                            <div className="pt-2 text-center text-[11px] text-gray-400">
                                Report generated for {report.meta?.employeeName} • {new Date(report.meta?.generatedAt || Date.now()).toLocaleString()} • Powered by Gemini AI
                            </div>
                        </>
                    )}
                </div>

                {/* ─── Footer Controls (Single Download PDF Button) ─────────────── */}
                <div className="flex items-center justify-between px-6 py-3.5 bg-white border-t border-gray-100 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:inline">
                        {report ? `Generated for ${report.meta.employeeName}` : ''}
                    </span>
                    <div className="flex items-center gap-2.5 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-xs transition-colors"
                        >
                            Close
                        </button>
                        {report && (
                            <PDFDownloadLink
                                document={<AiWorkReportPDF report={report} />}
                                fileName={`AI-Work-Report-${report.meta.employeeName.replace(/\s+/g, '-')}-${report.meta.startDate}.pdf`}
                                className="inline-flex items-center gap-1.5 px-4.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                                {({ loading }) => (
                                    <>
                                        <Download size={13} />
                                        <span>{loading ? 'Preparing PDF...' : 'Download PDF'}</span>
                                    </>
                                )}
                            </PDFDownloadLink>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
