'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import type { GlobalPermissions } from '@/lib/definitions';
import {
    PlanPermissionsMatrix,
    type PlanPermissionsMap,
} from './plan-permissions-matrix';
import { moduleCategories } from '@/lib/permission-modules';

interface PlanPermissionSelectorProps {
    defaultPermissions?: GlobalPermissions | PlanPermissionsMap;
    /** Hidden input name used when submitting via a form action. */
    name?: string;
}

/**
 * Normalize legacy nested `{ agent: { module: {...} } }` plans to the new
 * flat `{ module: {...} }` shape the rest of the codebase expects.
 */
function normalizeLegacy(raw: any): PlanPermissionsMap {
    if (!raw || typeof raw !== 'object') return {};
    const knownModules = new Set(
        Object.values(moduleCategories).flatMap((m) => m),
    );
    const rootMatches = Object.keys(raw).filter((k) => knownModules.has(k));
    if (rootMatches.length > 0) return raw as PlanPermissionsMap;
    if (raw.agent && typeof raw.agent === 'object') {
        return raw.agent as PlanPermissionsMap;
    }
    return {};
}

/**
 * Plan permission editor used inside the plan editor form.
 * Keeps the permissions in client state and emits a single hidden JSON
 * field so the server action can parse it without iterating over 292
 * formData keys.
 */
export function PlanPermissionSelector({
    defaultPermissions,
    name = 'permissionsJson',
}: PlanPermissionSelectorProps) {
    const [permissions, setPermissions] = React.useState<PlanPermissionsMap>(() =>
        normalizeLegacy(defaultPermissions),
    );

    return (
        <Card className="rounded-2xl border-white/10 bg-white/5 backdrop-blur-xl shadow-lg overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Master Permission Control</CardTitle>
                        <CardDescription>
                            Define the absolute ceiling of what users on this plan can do. Anything
                            unchecked here is blocked application-wide, even for paying users.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <input type="hidden" name={name} value={JSON.stringify(permissions)} />
                <PlanPermissionsMatrix value={permissions} onChange={setPermissions} />
            </CardContent>
        </Card>
    );
}
