'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Badge } from '@/components/sabcrm/20ui/compat';
import { Sparkles, Building2, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function AccountIntelligence() {
    const [isEnriching, setIsEnriching] = React.useState(false);

    const handleEnrich = () => {
        setIsEnriching(true);
        // Simulate an API call to enrichment service (Clearbit/LinkedIn)
        setTimeout(() => {
            setIsEnriching(false);
            toast.success('Account Enriched!', {
                description: 'We found updated data for this account.',
            });
        }, 1500);
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--st-text)]" />
                    Account Intelligence
                </CardTitle>
            </CardHeader>
            <CardBody className="grid gap-4">
                <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] p-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-[var(--st-bg-muted)] p-2 dark:bg-[var(--st-text)]/20">
                            <TrendingUp className="h-4 w-4 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Account Health</p>
                            <p className="text-xs text-[var(--st-text-secondary)]">Based on recent activity</p>
                        </div>
                    </div>
                    <Badge variant="success">Good</Badge>
                </div>

                <div className="space-y-3 rounded-lg border border-[var(--st-border)] p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-[var(--st-text)]" />
                        Enrichment Data
                    </h4>
                    <p className="text-xs text-[var(--st-text-secondary)] leading-relaxed">
                        Auto-populate commercial and contact details using our third-party enrichment providers.
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full flex items-center gap-2" 
                        onClick={handleEnrich}
                        disabled={isEnriching}
                    >
                        {isEnriching ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        {isEnriching ? 'Enriching...' : 'Run Enrichment'}
                    </Button>
                </div>

                <div className="rounded-lg bg-[var(--st-bg-muted)] p-3 flex items-start gap-2 text-xs text-[var(--st-text-secondary)]">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--st-text)]" />
                    <p>
                        Enriched data will pre-fill any empty fields without overwriting your existing manual changes.
                    </p>
                </div>
            </CardBody>
        </Card>
    );
}
