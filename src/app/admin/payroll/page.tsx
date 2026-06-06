'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Badge,
} from '@/components/sabcrm/20ui/compat';
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
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Period</ZoruTableHead>
                            <ZoruTableHead className="text-right">Employees</ZoruTableHead>
                            <ZoruTableHead className="text-right">Gross</ZoruTableHead>
                            <ZoruTableHead className="text-right">Net</ZoruTableHead>
                            <ZoruTableHead className="text-center">Status</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {isLoading ? (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={5} className="h-24 text-center text-[var(--st-text-secondary)]">
                                    Loading...
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : runs.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell colSpan={5} className="h-24 text-center text-[var(--st-text-secondary)]">
                                    No payroll runs found.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            runs.map((r) => (
                                <ZoruTableRow key={r._id}>
                                    <ZoruTableCell className="text-[var(--st-text)] font-medium">
                                        {r.period_month}/{r.period_year}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[var(--st-text)]">
                                        {r.total_employees || 0}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[var(--st-text)]">
                                        ₹{(r.total_gross || 0).toLocaleString('en-IN')}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[var(--st-text)]">
                                        ₹{(r.total_net || 0).toLocaleString('en-IN')}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-center">
                                        {statusBadge(r.status)}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))
                        )}
                    </ZoruTableBody>
                </Table>
            </div>
        </EntityListShell>
    );
}
