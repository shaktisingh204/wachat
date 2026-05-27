import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardContent } from '@/components/zoruui';

import { listSabmonitorSyntheticScripts } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

export default async function SyntheticScriptsPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorSyntheticScripts();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">Synthetic browser scripts</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/synthetic-scripts/new">New script</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No scripts yet.</p>
                    ) : (
                        <ul className="divide-y divide-zoru-line">
                            {res.items.map((s) => (
                                <li key={s._id} className="flex items-center justify-between p-3">
                                    <Link
                                        className="text-sm font-medium text-zoru-ink hover:underline"
                                        href={`/dashboard/sabmonitor/synthetic-scripts/${s._id}`}
                                    >
                                        {s.name}
                                    </Link>
                                    <span className="text-[12px] text-zoru-ink-muted">
                                        {s.screenshotOnFailure ? 'screenshots on failure' : '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
