import { Cog } from 'lucide-react';

import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';

export default function SabFilesSettingsPage() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Cog className="h-5 w-5" />
                <h1 className="text-xl font-semibold text-zoru-ink">SabFiles settings</h1>
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Storage</ZoruCardTitle>
                    <ZoruCardDescription>
                        SabFiles stores objects on Cloudflare R2. Configure these
                        environment variables on the server:
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <ul className="grid gap-1 text-sm text-zoru-ink-muted">
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">R2_ACCOUNT_ID</code> — Cloudflare account id
                        </li>
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">R2_ACCESS_KEY_ID</code> — R2 token access key
                        </li>
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">R2_SECRET_ACCESS_KEY</code> — R2 token secret
                        </li>
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">R2_BUCKET</code> — bucket name
                        </li>
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">R2_PUBLIC_URL</code> — optional public CDN base
                        </li>
                        <li>
                            <code className="rounded bg-zoru-surface px-1.5 py-0.5">SABFILES_USER_QUOTA_BYTES</code> — optional per-user quota in bytes
                        </li>
                    </ul>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>CORS</ZoruCardTitle>
                    <ZoruCardDescription>
                        Browser uploads go directly to R2 with a presigned PUT URL,
                        so the bucket must allow PUT from your dashboard origin.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <pre className="overflow-x-auto rounded-[var(--zoru-radius)] bg-zoru-surface p-3 text-xs">
{`[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]`}
                    </pre>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
