'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Key, Shield, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { m } from 'motion/react';

import { PageHeader } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Card, CardBody, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/sabcrm/20ui';
import { Checkbox } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { fadeInUp, staggerContainer } from '@/lib/motion';

// Mock scope categories and operations
const SCOPE_CATEGORIES = [
    { id: 'users', name: 'Users', description: 'Manage user accounts and profiles.' },
    { id: 'roles', name: 'Roles & Permissions', description: 'Configure access control and role assignments.' },
    { id: 'webhooks', name: 'Webhooks', description: 'Manage event-driven webhooks and endpoints.' },
    { id: 'billing', name: 'Billing', description: 'Access invoices, subscriptions, and payment methods.' },
    { id: 'analytics', name: 'Analytics', description: 'View usage metrics, logs, and reports.' },
    { id: 'settings', name: 'Global Settings', description: 'Modify core application configurations.' },
];

const OPERATIONS = [
    { id: 'read', label: 'Read' },
    { id: 'write', label: 'Write' },
    { id: 'delete', label: 'Delete' },
    { id: 'manage', label: 'Manage' },
];

export default function CredentialScopesPage() {
    const params = useParams();
    const router = useRouter();
    const credentialId = params?.id as string || 'cred_unknown';

    // State to hold the current selected scopes.
    // Structure: Record<category_id, Record<operation_id, boolean>>
    const [scopes, setScopes] = React.useState<Record<string, Record<string, boolean>>>({
        users: { read: true, write: false, delete: false, manage: false },
        roles: { read: true, write: false, delete: false, manage: false },
        webhooks: { read: false, write: false, delete: false, manage: false },
        billing: { read: false, write: false, delete: false, manage: false },
        analytics: { read: true, write: false, delete: false, manage: false },
        settings: { read: false, write: false, delete: false, manage: false },
    });

    const [isSaving, setIsSaving] = React.useState(false);

    const handleToggleScope = (categoryId: string, operationId: string, checked: boolean) => {
        setScopes((prev) => {
            const next = { ...prev };
            if (!next[categoryId]) {
                next[categoryId] = {};
            }
            next[categoryId] = {
                ...next[categoryId],
                [operationId]: checked,
            };

            // If manage is checked, automatically check everything else in this category
            if (operationId === 'manage' && checked) {
                next[categoryId].read = true;
                next[categoryId].write = true;
                next[categoryId].delete = true;
            }

            return next;
        });
    };

    const handleToggleAllInCategory = (categoryId: string, checked: boolean) => {
        setScopes((prev) => {
            const next = { ...prev };
            next[categoryId] = {
                read: checked,
                write: checked,
                delete: checked,
                manage: checked,
            };
            return next;
        });
    };

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
        }, 1200);
    };

    // Calculate total scopes selected for the badge
    const totalSelected = React.useMemo(() => {
        let count = 0;
        Object.values(scopes).forEach((category) => {
            Object.values(category).forEach((val) => {
                if (val) count++;
            });
        });
        return count;
    }, [scopes]);

    const totalPossible = SCOPE_CATEGORIES.length * OPERATIONS.length;

    return (
        <m.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="p-6 max-w-6xl mx-auto space-y-6"
        >
            <PageHeader
                title="Manage Scopes"
                subtitle={`Configure fine-grained access permissions for credential ${credentialId}.`}
                icon={Key}
                breadcrumb={
                    <div 
                        className="flex items-center gap-2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors cursor-pointer" 
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Credentials</span>
                    </div>
                }
                actions={
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2 bg-[var(--st-text)] hover:bg-[var(--st-text)] text-white">
                        {isSaving ? <span className="animate-spin">⍥</span> : <Save className="h-4 w-4" />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
                mesh={true}
            />

            <m.div variants={fadeInUp}>
                <Card className="border-[var(--st-border)]/50 shadow-sm overflow-hidden backdrop-blur-xl bg-[var(--st-bg-secondary)]/50">
                    <CardHeader className="border-b bg-[var(--st-bg-muted)]/20 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                                    <Shield className="h-5 w-5 text-[var(--st-text)]" />
                                    Access Matrix
                                </CardTitle>
                                <CardDescription className="text-sm">
                                    Define the resources and operations this connection is allowed to access. Unchecked operations will be denied.
                                </CardDescription>
                            </div>
                            <Badge variant="secondary" className="px-3 py-1 text-xs font-mono shrink-0 bg-[var(--st-text)] text-[var(--st-text)]">
                                {totalSelected} / {totalPossible} Scopes Selected
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardBody className="p-0 overflow-x-auto">
                        <Table>
                            <THead className="bg-[var(--st-bg-muted)]/30">
                                <Tr>
                                    <Th className="w-[300px] py-4">Resource Category</Th>
                                    {OPERATIONS.map((op) => (
                                        <Th key={op.id} className="text-center py-4">{op.label}</Th>
                                    ))}
                                    <Th className="text-right py-4 pr-6">Quick Select</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {SCOPE_CATEGORIES.map((category) => {
                                    const categoryScopes = scopes[category.id] || {};
                                    const allChecked = OPERATIONS.every((op) => categoryScopes[op.id]);

                                    return (
                                        <Tr key={category.id} className="group hover:bg-[var(--st-bg-muted)]/10 transition-colors">
                                            <Td className="font-medium py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[var(--st-text)]">{category.name}</span>
                                                    <span className="text-xs text-[var(--st-text-secondary)] font-normal">
                                                        {category.description}
                                                    </span>
                                                </div>
                                            </Td>
                                            {OPERATIONS.map((op) => (
                                                <Td key={op.id} className="text-center py-4">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            checked={!!categoryScopes[op.id]}
                                                            onCheckedChange={(checked) =>
                                                                handleToggleScope(category.id, op.id, checked as boolean)
                                                            }
                                                            aria-label={`${op.label} ${category.name}`}
                                                        />
                                                    </div>
                                                </Td>
                                            ))}
                                            <Td className="text-right py-4 pr-6">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={allChecked 
                                                        ? "h-8 text-xs font-medium text-[var(--st-text)] bg-[var(--st-text)] hover:bg-[var(--st-text)] hover:text-[var(--st-text)]" 
                                                        : "h-8 text-xs font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                                    }
                                                    onClick={() => handleToggleAllInCategory(category.id, !allChecked)}
                                                >
                                                    {allChecked ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardBody>
                    <CardFooter className="bg-[var(--st-bg-muted)]/20 border-t p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                         <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)] px-3 py-2 rounded-md">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>Changes to scopes will apply immediately to newly issued tokens.</span>
                        </div>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            className="shrink-0"
                            onClick={() => {
                              const resetScopes: Record<string, Record<string, boolean>> = {};
                              SCOPE_CATEGORIES.forEach(c => {
                                  resetScopes[c.id] = { read: false, write: false, delete: false, manage: false };
                              });
                              setScopes(resetScopes);
                         }}>
                            Clear All Permissions
                        </Button>
                    </CardFooter>
                </Card>
            </m.div>
        </m.div>
    );
}
