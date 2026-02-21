import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { Proposal } from '@/features/crm/types/types';

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        lineHeight: 1.5,
        color: '#333333',
    },
    coverContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 50,
    },
    coverTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#1a365d',
    },
    coverSubtitle: {
        fontSize: 18,
        marginBottom: 40,
        color: '#4a5568',
    },
    coverMeta: {
        fontSize: 12,
        marginBottom: 10,
        textAlign: 'center',
    },
    section: {
        margin: 10,
        marginBottom: 20,
        padding: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#2b6cb0',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 5,
    },
    subSectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5,
        color: '#2d3748',
    },
    text: {
        marginBottom: 8,
        textAlign: 'justify',
    },
    bulletPoint: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    bullet: {
        width: 15,
        fontSize: 15,
        color: '#2b6cb0',
    },
    bulletText: {
        flex: 1,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    gridItem: {
        width: '48%',
        marginBottom: 10,
        padding: 8,
        backgroundColor: '#f7fafc',
        borderRadius: 4,
    },
    gridLabel: {
        fontSize: 8,
        color: '#718096',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    gridValue: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#2d3748',
    },
    table: {
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 10,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableCol: {
        width: '25%',
        borderStyle: 'solid',
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
        padding: 5,
    },
    tableCellHeader: {
        margin: 'auto',
        fontSize: 10,
        fontWeight: 'bold',
    },
    tableCell: {
        margin: 'auto',
        fontSize: 10,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        fontSize: 8,
        color: '#a0aec0',
        textAlign: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
    },
});

interface ProposalPDFProps {
    proposal: Proposal;
}

const ProposalPDF: React.FC<ProposalPDFProps> = ({ proposal }) => {
    return (
        <Document>
            {/* PAGE 1: COVER */}
            <Page size="A4" style={styles.page}>
                <View style={styles.coverContainer}>
                    <Text style={{ fontSize: 40, color: '#2b6cb0', marginBottom: 20 }}>PROPOSAL</Text>
                    <Text style={styles.coverTitle}>{proposal.title}</Text>

                    <View style={{ marginTop: 50 }}>
                        <Text style={styles.coverMeta}>PREPARED FOR:</Text>
                        <Text style={[styles.coverMeta, { fontWeight: 'bold', fontSize: 16 }]}>
                            {typeof proposal.leadId === 'object' ? (proposal.leadId as any).name : 'Client Name'}
                        </Text>
                        <Text style={styles.coverMeta}>
                            {typeof proposal.leadId === 'object' && (proposal.leadId as any).company ? (proposal.leadId as any).company : ''}
                        </Text>
                    </View>

                    <View style={{ marginTop: 30 }}>
                        <Text style={styles.coverMeta}>PREPARED BY:</Text>
                        <Text style={[styles.coverMeta, { fontWeight: 'bold' }]}>Creative Upaay</Text>
                    </View>

                    <View style={{ marginTop: 50 }}>
                        <Text style={styles.coverMeta}>DATE: {new Date().toLocaleDateString()}</Text>
                        {proposal.validUntil && (
                            <Text style={styles.coverMeta}>VALID UNTIL: {new Date(proposal.validUntil).toLocaleDateString()}</Text>
                        )}
                    </View>
                </View>
                <Text style={styles.footer}>Confidential - Creative Upaay - {new Date().getFullYear()}</Text>
            </Page>

            {/* PAGE 2: OVERVIEW & CHALLENGE */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Executive Summary</Text>

                    {proposal.overview?.project && (
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.subSectionTitle}>Project Overview</Text>
                            <Text style={styles.text}>{proposal.overview.project}</Text>
                        </View>
                    )}

                    {proposal.overview?.purpose && (
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.subSectionTitle}>Purpose</Text>
                            <Text style={styles.text}>{proposal.overview.purpose}</Text>
                        </View>
                    )}

                    {proposal.overview?.outcome && (
                        <View style={{ marginBottom: 10 }}>
                            <Text style={styles.subSectionTitle}>Outcome</Text>
                            <Text style={styles.text}>{proposal.overview.outcome}</Text>
                        </View>
                    )}
                </View>

                {proposal.businessChallenge && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. Business Context</Text>
                        <Text style={styles.text}>{proposal.businessChallenge.challenge}</Text>

                        {proposal.businessChallenge.painPoints && proposal.businessChallenge.painPoints.length > 0 && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.subSectionTitle}>Key Pain Points:</Text>
                                {proposal.businessChallenge.painPoints.map((pt, i) => (
                                    <View key={i} style={styles.bulletPoint}>
                                        <Text style={styles.bullet}>•</Text>
                                        <View style={styles.bulletText}>
                                            <Text style={{ fontWeight: 'bold' }}>{pt.title}</Text>
                                            <Text>{pt.description}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}
                <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </Page>
            {/* PAGE 3: SCOPE & FEATURES */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. Scope of Work</Text>
                    <Text style={styles.text}>{proposal.scopeOfWork?.intro}</Text>

                    {proposal.scopeOfWork?.phases?.map((phase, i) => (
                        <View key={i} style={{ marginBottom: 15, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#2b6cb0' }}>
                            <Text style={styles.subSectionTitle}>{phase.title}</Text>
                            <Text style={[styles.text, { fontSize: 9, color: '#666' }]}>{phase.summary}</Text>
                            {phase.points?.map((pt, j) => (
                                <View key={j} style={styles.bulletPoint}>
                                    <Text style={[styles.bullet, { fontSize: 10 }]}>-</Text>
                                    <Text style={styles.bulletText}>{pt}</Text>
                                </View>
                            ))}
                        </View>
                    ))}
                </View>

                {proposal.features?.phases && proposal.features.phases.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. Key Features</Text>
                        {proposal.features.phases.map((phase, i) => (
                            <View key={i} style={{ marginBottom: 15 }}>
                                <Text style={[styles.subSectionTitle, { color: '#2b6cb0' }]}>{phase.title}</Text>
                                {phase.features.map((feat, j) => (
                                    <View key={j} style={{ flexDirection: 'row', marginBottom: 5 }}>
                                        <Text style={{ width: 120, fontWeight: 'bold' }}>{feat.name}:</Text>
                                        <Text style={{ flex: 1 }}>{feat.description}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                )}
                <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </Page>

            {/* PAGE 4: TECH STACK & EXECUTION */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>5. Technical Implementation</Text>
                    {proposal.techStack?.intro && <Text style={styles.text}>{proposal.techStack.intro}</Text>}

                    <View style={styles.gridContainer}>
                        {Object.entries(proposal.techStack || {}).map(([key, value]) => {
                            if (key === 'intro' || key === 'integrations' || !value) return null;
                            return (
                                <View key={key} style={styles.gridItem}>
                                    <Text style={styles.gridLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</Text>
                                    <Text style={styles.gridValue}>{String(value)}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {proposal.timeline && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>6. Project Timeline</Text>
                        <Text style={styles.text}>{proposal.timeline.intro}</Text>

                        <View style={styles.table}>
                            <View style={[styles.tableRow, { backgroundColor: '#edf2f7' }]}>
                                <View style={[styles.tableCol, { width: '40%' }]}><Text style={styles.tableCellHeader}>Phase</Text></View>
                                <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCellHeader}>Duration</Text></View>
                                <View style={[styles.tableCol, { width: '40%', borderRightWidth: 0 }]}><Text style={styles.tableCellHeader}>Objective</Text></View>
                            </View>
                            {proposal.timeline.phases?.map((phase, i) => (
                                <View key={i} style={styles.tableRow}>
                                    <View style={[styles.tableCol, { width: '40%' }]}><Text style={styles.tableCell}>{phase.title}</Text></View>
                                    <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{phase.duration}</Text></View>
                                    <View style={[styles.tableCol, { width: '40%', borderRightWidth: 0 }]}><Text style={styles.tableCell}>{phase.objective}</Text></View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
                <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </Page>

            {/* PAGE 5: BUDGET & TERMS */}
            <Page size="A4" style={styles.page}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>7. Commercials</Text>
                    {/* Simplified Budget Table */}
                    {proposal.budgetV2 && (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.subSectionTitle}>Investment Breakdown</Text>
                            {/* If budgetV2 total is populated, show it, else show Line Items Total */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#f0fff4', borderRadius: 4, marginTop: 10 }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold' }}>TOTAL PROJECT COST:</Text>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2f855a' }}>
                                    {proposal.currency} {proposal.total?.toLocaleString()}
                                </Text>
                            </View>

                            <Text style={[styles.subSectionTitle, { marginTop: 20 }]}>Payment Schedule</Text>
                            <View style={styles.table}>
                                {proposal.budgetV2.paymentSchedule?.map((ms, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <View style={[styles.tableCol, { width: '50%' }]}><Text style={styles.tableCell}>{ms.milestone}</Text></View>
                                        <View style={[styles.tableCol, { width: '25%' }]}><Text style={styles.tableCell}>{ms.percentage}%</Text></View>
                                        <View style={[styles.tableCol, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.tableCell}>{proposal.currency} {ms.amount}</Text></View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {proposal.terms && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>8. Terms & Conditions</Text>
                        {proposal.terms.intro && <Text style={styles.text}>{proposal.terms.intro}</Text>}
                        {proposal.terms.clauses?.map((clause, i) => (
                            <Text key={i} style={[styles.text, { fontSize: 8, color: '#666', marginBottom: 4 }]}>
                                {i + 1}. {clause}
                            </Text>
                        ))}
                    </View>
                )}

                <View style={{ marginTop: 50, borderTopWidth: 1, borderTopColor: '#000', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ width: '40%' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 40 }}>ACCEPTED BY (CLIENT):</Text>
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 5 }}></View>
                        <Text>Signature & Date</Text>
                    </View>
                    <View style={{ width: '40%' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 40 }}>FOR CREATIVE UPAAY:</Text>
                        <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 5 }}></View>
                        <Text>Signature & Date</Text>
                    </View>
                </View>

                <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
            </Page>
        </Document>
    );
};

export default ProposalPDF;
