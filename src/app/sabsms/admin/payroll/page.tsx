'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listPayrollRuns, type CrmPayrollRunDoc } from '@/app/actions/crm-payroll-runs.actions';

function statusBadge(status: string) {
    if (status === 'processed' || status === 'paid') return <Badge variant="success">{status}</Badge>;
    if (status === 'in_progress') return <Badge variant="warning">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
}

export default function SabSmsAdminPayrollPage() {
    const [runs, setRuns] = useState<CrmPayrollRunDoc[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchRuns() {
            try {
                const data = await listPayrollRuns();
                setRuns(data);
            } catch (error) {
                console.error("Failed to fetch payroll runs", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchRuns();
    }, []);

    return (
        <EntityListShell
            title="Payroll Administration"
            subtitle="Manage payroll runs across the system."
        >
            <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                <Table>
                    <THead>
                        <Tr>
                            <Th>Period</Th>
                            <Th className="text-right">Employees</Th>
                            <Th className="text-right">Gross</Th>
                            <Th className="text-right">Net</Th>
                            <Th className="text-center">Status</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {isLoading ? (
                            <Tr>
                                <Td colSpan={5} className="h-24 text-center text-[var(--st-text-secondary)]">
                                    Loading...
                                </Td>
                            </Tr>
                        ) : runs.length === 0 ? (
                            <Tr>
                                <Td colSpan={5} className="h-24 text-center text-[var(--st-text-secondary)]">
                                    No payroll runs found.
                                </Td>
                            </Tr>
                        ) : (
                            runs.map((r) => (
                                <Tr key={r._id}>
                                    <Td className="text-[var(--st-text)] font-medium">
                                        {r.period_month}/{r.period_year}
                                    </Td>
                                    <Td className="text-right text-[var(--st-text)]">
                                        {r.total_employees || 0}
                                    </Td>
                                    <Td className="text-right font-mono text-[var(--st-text)]">
                                        ₹{(r.total_gross || 0).toLocaleString('en-IN')}
                                    </Td>
                                    <Td className="text-right font-mono text-[var(--st-text)]">
                                        ₹{(r.total_net || 0).toLocaleString('en-IN')}
                                    </Td>
                                    <Td className="text-center">
                                        {statusBadge(r.status)}
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </div>
        </EntityListShell>
    );
}
