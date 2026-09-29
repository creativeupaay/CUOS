import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { AiWorkReport } from '@/features/project/types/types';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 32,
        fontFamily: 'Helvetica',
        fontSize: 9,
        lineHeight: 1.45,
        color: '#1F2937',
    },
    // Header
    headerContainer: {
        borderBottomWidth: 1.5,
        borderBottomColor: '#10B981',
        paddingBottom: 12,
        marginBottom: 14,
    },
    brandRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    brandTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#047857',
        letterSpacing: -0.2,
    },
    sourceBadge: {
        backgroundColor: '#D1FAE5',
        color: '#065F46',
        fontSize: 7.5,
        fontWeight: 'bold',
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 99,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        fontSize: 8,
        color: '#4B5563',
        marginTop: 3,
    },
    metaItem: {
        marginRight: 14,
        marginBottom: 2,
    },
    metaBold: {
        fontWeight: 'bold',
        color: '#111827',
    },

    // Executive Summary Box
    summaryBox: {
        backgroundColor: '#F0FDF4',
        borderLeftWidth: 3,
        borderLeftColor: '#10B981',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#DCFCE7',
        padding: 10,
        borderRadius: 4,
        marginBottom: 12,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    summaryLabel: {
        fontSize: 7.5,
        fontWeight: 'bold',
        color: '#065F46',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    healthBadgeHealthy: {
        backgroundColor: '#D1FAE5',
        color: '#065F46',
        fontSize: 7,
        fontWeight: 'bold',
        paddingVertical: 1.5,
        paddingHorizontal: 6,
        borderRadius: 3,
    },
    healthBadgeWarning: {
        backgroundColor: '#FEF3C7',
        color: '#92400E',
        fontSize: 7,
        fontWeight: 'bold',
        paddingVertical: 1.5,
        paddingHorizontal: 6,
        borderRadius: 3,
    },
    healthBadgeFlagged: {
        backgroundColor: '#FEE2E2',
        color: '#991B1B',
        fontSize: 7,
        fontWeight: 'bold',
        paddingVertical: 1.5,
        paddingHorizontal: 6,
        borderRadius: 3,
    },
    summaryText: {
        fontSize: 8.5,
        color: '#1F2937',
        lineHeight: 1.4,
    },
    statPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        paddingTop: 5,
        borderTopWidth: 1,
        borderTopColor: '#DCFCE7',
    },
    statPill: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#D1FAE5',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 3,
        marginRight: 6,
        fontSize: 7.5,
        color: '#065F46',
    },

    // Section Titles
    section: {
        marginBottom: 11,
    },
    sectionTitle: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 3,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Grid Row & Cards
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    gridCol3: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        padding: 6,
        marginRight: 6,
    },
    lastGridCol: {
        marginRight: 0,
    },
    metricLabel: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#6B7280',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    metricValueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    metricValue: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#111827',
    },
    metricBadgeGreen: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#065F46',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    metricBadgeAmber: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#92400E',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    metricSub: {
        fontSize: 7,
        color: '#9CA3AF',
    },
    velocityBox: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#D1FAE5',
        borderRadius: 3,
        padding: 5,
        marginTop: 4,
        fontSize: 7.5,
        color: '#065F46',
    },

    // Audit Section
    auditCardFlag: {
        backgroundColor: '#FEF2F2',
        borderLeftWidth: 2.5,
        borderLeftColor: '#EF4444',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#FEE2E2',
        padding: 6,
        borderRadius: 3,
        marginBottom: 4,
    },
    auditCardWarning: {
        backgroundColor: '#FFFBEB',
        borderLeftWidth: 2.5,
        borderLeftColor: '#F59E0B',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#FEF3C7',
        padding: 6,
        borderRadius: 3,
        marginBottom: 4,
    },
    auditCardPositive: {
        backgroundColor: '#F0FDF4',
        borderLeftWidth: 2.5,
        borderLeftColor: '#10B981',
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#DCFCE7',
        padding: 6,
        borderRadius: 3,
        marginBottom: 4,
    },
    auditHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    auditTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#111827',
    },
    auditImpact: {
        fontSize: 6.5,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 2,
    },
    auditDesc: {
        fontSize: 7.5,
        color: '#4B5563',
        lineHeight: 1.35,
    },
    auditTasksRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 3,
    },
    auditTaskTag: {
        fontSize: 6.5,
        color: '#374151',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        marginRight: 4,
        marginTop: 2,
    },

    // Work Progression Timeline
    progStep: {
        backgroundColor: '#FAFCFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        padding: 6,
        marginBottom: 5,
    },
    progHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    progStageTitle: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#065F46',
    },
    progDatePill: {
        fontSize: 7,
        fontWeight: 'bold',
        color: '#047857',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    progDesc: {
        fontSize: 7.5,
        color: '#4B5563',
        marginBottom: 3,
    },
    progTasks: {
        fontSize: 7,
        color: '#6B7280',
    },

    // Workstreams
    wsCard: {
        backgroundColor: '#FAFCFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        padding: 6,
        marginBottom: 5,
    },
    wsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    wsTitle: {
        fontSize: 8.5,
        fontWeight: 'bold',
        color: '#111827',
    },
    wsPill: {
        backgroundColor: '#ECFDF5',
        color: '#047857',
        fontSize: 7,
        fontWeight: 'bold',
        paddingVertical: 1,
        paddingHorizontal: 5,
        borderRadius: 2,
    },
    wsSummary: {
        fontSize: 7.5,
        color: '#4B5563',
        marginBottom: 2,
    },
    wsTasks: {
        fontSize: 7,
        color: '#6B7280',
        marginTop: 1,
    },
    wsObservation: {
        fontSize: 7,
        color: '#065F46',
        backgroundColor: '#F0FDF4',
        padding: 3,
        borderRadius: 2,
        marginTop: 2,
    },

    // Recommendations
    sugItem: {
        flexDirection: 'row',
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 3,
        padding: 5,
        marginBottom: 4,
    },
    sugNum: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        color: '#FFFFFF',
        fontSize: 7,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 12,
        marginRight: 5,
    },
    sugContent: {
        flex: 1,
    },
    sugTitle: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#065F46',
        marginBottom: 1,
    },
    sugDesc: {
        fontSize: 7.2,
        color: '#374151',
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 18,
        left: 32,
        right: 32,
        fontSize: 7,
        color: '#9CA3AF',
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 5,
    },
});

interface AiWorkReportPDFProps {
    report: AiWorkReport;
}

export const AiWorkReportPDF: React.FC<AiWorkReportPDFProps> = ({ report }) => {
    const executiveSummary = report.executiveSummary || report.managerSummary || report.overview;
    const auditHealth = report.workAudit?.overallHealth || 'healthy';
    const auditLabel = report.workAudit?.healthScoreLabel || (auditHealth === 'healthy' ? 'Clean Record & On Track' : 'Review Recommended');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* ─── Header ────────────────────────────────────────────── */}
                <View style={styles.headerContainer}>
                    <View style={styles.brandRow}>
                        <Text style={styles.brandTitle}>CUOS • AI Work Review Report</Text>
                        <Text style={styles.sourceBadge}>
                            {report.meta?.source === 'analytics' ? 'CUOS Intelligence' : 'Gemini AI'}
                        </Text>
                    </View>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Text>
                                Employee: <Text style={styles.metaBold}>{report.meta.employeeName}</Text>
                                {report.meta.designation ? ` (${report.meta.designation})` : ''}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text>
                                Period: <Text style={styles.metaBold}>{report.meta.startDate} to {report.meta.endDate}</Text>
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Text>
                                Tracked Time: <Text style={styles.metaBold}>{report.meta.totalTrackedTime}</Text>
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ─── 1. Executive Summary & Review (Single Clean Paragraph) ─ */}
                {executiveSummary && (
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryHeader}>
                            <Text style={styles.summaryLabel}>Executive Summary & Work Review</Text>
                            <Text style={
                                auditHealth === 'healthy'
                                    ? styles.healthBadgeHealthy
                                    : auditHealth === 'flagged'
                                    ? styles.healthBadgeFlagged
                                    : styles.healthBadgeWarning
                            }>
                                {auditLabel}
                            </Text>
                        </View>
                        <Text style={styles.summaryText}>{executiveSummary}</Text>

                        {/* Quick Stats Pills */}
                        <View style={styles.statPillsRow}>
                            <Text style={styles.statPill}>Tracked: {report.meta.totalTrackedTime}</Text>
                            {report.periodComparison && (
                                <>
                                    <Text style={styles.statPill}>Active Days: {report.periodComparison.currentActiveDays}</Text>
                                    <Text style={styles.statPill}>Completed: {report.periodComparison.currentCompletedTasks} tasks</Text>
                                </>
                            )}
                            {report.workstreams && report.workstreams[0] && (
                                <Text style={styles.statPill}>Focus: {report.workstreams[0].name}</Text>
                            )}
                        </View>
                    </View>
                )}

                {/* ─── 2. Velocity & Period Trend ───────────────────────── */}
                {report.periodComparison && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Progress & Performance Comparison ({report.periodComparison.periodLabel})
                        </Text>
                        <View style={styles.gridRow}>
                            {/* Tracked Effort */}
                            <View style={styles.gridCol3}>
                                <Text style={styles.metricLabel}>Tracked Time</Text>
                                <View style={styles.metricValueRow}>
                                    <Text style={styles.metricValue}>{report.periodComparison.currentTimeFormatted}</Text>
                                    <Text style={
                                        report.periodComparison.timeChangeDirection === 'increase'
                                            ? styles.metricBadgeGreen
                                            : styles.metricBadgeAmber
                                    }>
                                        {report.periodComparison.timeChangeDirection === 'increase' ? '+' : ''}
                                        {report.periodComparison.timeChangePercentage}%
                                    </Text>
                                </View>
                                <Text style={styles.metricSub}>Prior: {report.periodComparison.previousTimeFormatted}</Text>
                            </View>

                            {/* Tasks Completed */}
                            <View style={styles.gridCol3}>
                                <Text style={styles.metricLabel}>Tasks Completed</Text>
                                <View style={styles.metricValueRow}>
                                    <Text style={styles.metricValue}>{report.periodComparison.currentCompletedTasks}</Text>
                                    <Text style={
                                        report.periodComparison.completedTasksChange >= 0
                                            ? styles.metricBadgeGreen
                                            : styles.metricBadgeAmber
                                    }>
                                        {report.periodComparison.completedTasksChange >= 0 ? `+${report.periodComparison.completedTasksChange}` : report.periodComparison.completedTasksChange}
                                    </Text>
                                </View>
                                <Text style={styles.metricSub}>Prior: {report.periodComparison.previousCompletedTasks} completed</Text>
                            </View>

                            {/* Active Days */}
                            <View style={[styles.gridCol3, styles.lastGridCol]}>
                                <Text style={styles.metricLabel}>Working Days</Text>
                                <View style={styles.metricValueRow}>
                                    <Text style={styles.metricValue}>{report.periodComparison.currentActiveDays} days</Text>
                                    <Text style={styles.metricSub}>Prior: {report.periodComparison.previousActiveDays} days</Text>
                                </View>
                                <Text style={styles.metricSub}>Days with active work logged</Text>
                            </View>
                        </View>
                        {report.periodComparison.velocitySummary && (
                            <View style={styles.velocityBox}>
                                <Text>{report.periodComparison.velocitySummary}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ─── 3. Work Integrity & Activity Audit ────────────────── */}
                {report.workAudit && report.workAudit.signals && report.workAudit.signals.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Work Quality & Integrity Review ({report.workAudit.healthScoreLabel})
                        </Text>
                        {report.workAudit.signals.map((sig, sIdx) => {
                            const isFlag = sig.severity === 'flag';
                            const isWarning = sig.severity === 'warning';
                            const cardStyle = isFlag
                                ? styles.auditCardFlag
                                : isWarning
                                ? styles.auditCardWarning
                                : styles.auditCardPositive;

                            return (
                                <View key={sIdx} style={cardStyle}>
                                    <View style={styles.auditHeaderRow}>
                                        <Text style={styles.auditTitle}>
                                            {isFlag ? '⚠️ [FLAGGED] ' : isWarning ? '⚡ [ATTENTION] ' : '✓ [ON TRACK] '}
                                            {sig.title}
                                        </Text>
                                        {sig.impact && (
                                            <Text style={[
                                                styles.auditImpact,
                                                { color: isFlag ? '#991B1B' : isWarning ? '#92400E' : '#065F46' }
                                            ]}>
                                                {sig.impact}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={styles.auditDesc}>{sig.description}</Text>
                                    {sig.relatedTasks && sig.relatedTasks.length > 0 && (
                                        <View style={styles.auditTasksRow}>
                                            {sig.relatedTasks.map((tName, tIdx) => (
                                                <Text key={tIdx} style={styles.auditTaskTag}>
                                                    {tName}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ─── 4. Chronological Work Progression ────────────────── */}
                {report.workProgression && report.workProgression.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Work Timeline & Milestones</Text>
                        {report.workProgression.map((wp: any, idx: number) => {
                            const stepTitle = wp.stageTitle || wp.title || `Phase ${idx + 1}`;
                            const dateRange = wp.dateRange || '';
                            const timeSpent = wp.timeSpent || '';

                            return (
                                <View key={idx} style={styles.progStep}>
                                    <View style={styles.progHeader}>
                                        <Text style={styles.progStageTitle}>
                                            {idx + 1}. {stepTitle}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            {dateRange && <Text style={styles.progDatePill}>{dateRange}</Text>}
                                            {timeSpent && (
                                                <Text style={[styles.progDatePill, { marginLeft: 4, backgroundColor: '#F3F4F6', color: '#374151' }]}>
                                                    {timeSpent}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <Text style={styles.progDesc}>{wp.description}</Text>
                                    {wp.tasksInvolved && wp.tasksInvolved.length > 0 && (
                                        <Text style={styles.progTasks}>
                                            Tasks: {wp.tasksInvolved.join(' • ')}
                                        </Text>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ─── 5. Synthesized Workstreams ──────────────────────── */}
                {report.workstreams && report.workstreams.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Key Workstreams</Text>
                        {report.workstreams.map((ws, i) => (
                            <View key={i} style={styles.wsCard}>
                                <View style={styles.wsHeader}>
                                    <Text style={styles.wsTitle}>• {ws.name}</Text>
                                    <Text style={styles.wsPill}>
                                        {ws.totalTime} ({ws.activeDays} {ws.activeDays === 1 ? 'day' : 'days'})
                                    </Text>
                                </View>
                                <Text style={styles.wsSummary}>{ws.summary}</Text>
                                {ws.relatedTaskNames && ws.relatedTaskNames.length > 0 && (
                                    <Text style={styles.wsTasks}>
                                        Included: {ws.relatedTaskNames.join(', ')}
                                    </Text>
                                )}
                                {ws.observation && (
                                    <Text style={styles.wsObservation}>Observation: {ws.observation}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* ─── 6. Constructive Recommendations ─────────────────── */}
                {report.suggestions && report.suggestions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Key Recommendations</Text>
                        {report.suggestions.map((sug, idx) => (
                            <View key={idx} style={styles.sugItem}>
                                <Text style={styles.sugNum}>{idx + 1}</Text>
                                <View style={styles.sugContent}>
                                    <Text style={styles.sugTitle}>{sug.title}</Text>
                                    <Text style={styles.sugDesc}>{sug.description}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ─── Footer ───────────────────────────────────────────── */}
                <Text style={styles.footer}>
                    Creative Upaay Operating System (CUOS) • Confidential Internal Work Report • Generated {new Date(report.meta.generatedAt || Date.now()).toLocaleDateString()}
                </Text>
            </Page>
        </Document>
    );
};

export default AiWorkReportPDF;
