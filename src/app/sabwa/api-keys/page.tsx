import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyRound } from 'lucide-react';

export const metadata = { title: 'API Keys — SabWa' };

export default function Page() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-secondary p-3">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            REST tokens scoped to the SabWa module, reusing the same pattern as the main dashboard API.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>
            Generate, rotate, and revoke REST tokens with module-scoped permissions, plus deep links into the public API docs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm list-disc pl-5">
            <li>Generate REST tokens scoped to the SabWa module.</li>
            <li>Reuses the existing pattern from <code>/dashboard/api</code>.</li>
            <li>Per-token scopes for read, send, and admin operations.</li>
            <li>Rotate and revoke keys with audit trail.</li>
            <li>Last-used timestamp and call counter per key.</li>
            <li>Docs link to <code>/dashboard/api/docs#sabwa</code>.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
