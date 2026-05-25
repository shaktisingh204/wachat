'use client';

import * as React from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Button, Badge } from '@/components/zoruui';
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
            <ZoruCardHeader className="pb-4">
                <ZoruCardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    Account Intelligence
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4">
                <div className="flex items-center justify-between rounded-lg border border-zoru-line p-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-900/20">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Account Health</p>
                            <p className="text-xs text-zoru-ink-muted">Based on recent activity</p>
                        </div>
                    </div>
                    <Badge variant="success">Good</Badge>
                </div>

                <div className="space-y-3 rounded-lg border border-zoru-line p-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-zoru-ink" />
                        Enrichment Data
                    </h4>
                    <p className="text-xs text-zoru-ink-muted leading-relaxed">
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

                <div className="rounded-lg bg-zoru-surface-2 p-3 flex items-start gap-2 text-xs text-zoru-ink-muted">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <p>
                        Enriched data will pre-fill any empty fields without overwriting your existing manual changes.
                    </p>
                </div>
            </ZoruCardContent>
        </Card>
    );
}
