'use client';

import { ZoruBadge, ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useTransition } from 'react';
import { ListChecks,
  Sparkles,
  LoaderCircle,
  Type } from 'lucide-react';

/**
 * Permission Types settings — §1D.4 bar:
 *  - KPI strip (Total · With display name)
 *  - Search across name / display name
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - "Seed defaults" extra header action (re-seeds the standard
 *    none/all/added/owned/both vocabulary)
 */

import * as React from 'react';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
    getPermissionTypes,
    savePermissionType,
    deletePermissionType,
    seedPermissionTypes,
} from '@/app/actions/worksuite/rbac.actions';
import type { WsPermissionType } from '@/lib/worksuite/rbac-types';

type Row = WsPermissionType & { _id: string };

export default function PermissionTypesPage() {
    const { toast } = useZoruToast();
    const [isSeeding, startSeed] = useTransition();
    const [seedKey, setSeedKey] = React.useState(0);

    const getAll = React.useCallback(async () => {
        return (await getPermissionTypes()) as Row[];
    }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const doSeed = () =>
        startSeed(async () => {
            const res = await seedPermissionTypes();
            toast({
                title: 'Seeded',
                description: `Inserted ${res.inserted} types.`,
            });
            setSeedKey((k) => k + 1);
        });

    return (
        <SettingsEntityShell<Row>
            title="Permission Types"
            subtitle="The scope vocabulary used when granting a permission to a role."
            singular="Type"
            getAllAction={getAll}
            saveAction={savePermissionType}
            deleteAction={deletePermissionType}
            csvFilename="permission-types"
            kpis={(_rows, all) => [
                {
                    label: 'Total',
                    value: all.length,
                    icon: <ListChecks className="h-4 w-4" />,
                },
                {
                    label: 'With display name',
                    value: all.filter((r) => (r.display_name || '').trim().length).length,
                    icon: <Type className="h-4 w-4" />,
                },
            ]}
            extraHeaderActions={
                <ZoruButton variant="outline" disabled={isSeeding} onClick={doSeed}>
                    {isSeeding ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4" />
                    )}
                    Seed defaults
                </ZoruButton>
            }
            columns={[
                {
                    key: 'name',
                    label: 'Name',
                    render: (row) => (
                        <RowDrawer
                            label={<ZoruBadge variant="ghost">{row.name}</ZoruBadge>}
                            subtitle={row.display_name || undefined}
                            title={`Permission Type · ${row.name}`}
                            description="Read-only details. Use the row Edit action to modify."
                        >
                            <div className="space-y-3 text-sm">
                                <div>
                                    <div className="text-muted-foreground text-xs">Name</div>
                                    <div className="font-mono">{row.name}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground text-xs">Display name</div>
                                    <div>{row.display_name || '—'}</div>
                                </div>
                            </div>
                        </RowDrawer>
                    ),
                },
                {
                    key: 'display_name',
                    label: 'Display',
                    render: (row) => row.display_name || '—',
                },
            ]}
            fields={[
                { name: 'name', label: 'Name', required: true, placeholder: 'all' },
                {
                    name: 'display_name',
                    label: 'Display name',
                    placeholder: 'All',
                },
            ]}
        />
    );
}
