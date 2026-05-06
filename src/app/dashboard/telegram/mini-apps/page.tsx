'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Package } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { listTelegramMiniAppsAction } from '@/app/actions/telegram-extra.actions';
import type { MiniAppEntry } from '@/lib/rust-client/telegram-mini-apps';

import {
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
} from '@/components/zoruui';

export default function TelegramMiniAppsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';
  const [apps, setApps] = useState<MiniAppEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    (async () => setApps(await listTelegramMiniAppsAction(projectId)))();
  }, [projectId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <ZoruEmptyState
          icon={<Package />}
          title="No project selected"
          description="Pick a project."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
            boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
          }}
        >
          <Package className="h-6 w-6 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[22px] leading-tight text-zoru-ink">Mini Apps</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-zoru-ink-muted">
            Bots in this project that have a Mini App URL configured. Edit URLs from{' '}
            <Link
              className="underline decoration-zoru-line"
              href="/dashboard/telegram/settings"
            >
              Settings
            </Link>
            . Backed by <code>telegram-mini-apps</code>.
          </p>
        </div>
      </header>

      {apps.length === 0 ? (
        <ZoruEmptyState
          icon={<Package />}
          title="No mini apps configured"
          description="Set a Mini App URL on any bot from the Settings page."
          action={
            <ZoruButton asChild>
              <Link href="/dashboard/telegram/settings">Configure</Link>
            </ZoruButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <ZoruCard key={a.botId} className="flex flex-col gap-2 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base text-zoru-ink">@{a.username}</p>
                  <p className="text-xs text-zoru-ink-muted">{a.name}</p>
                </div>
                <ZoruButton asChild variant="outline" size="sm">
                  <a
                    href={a.miniAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </a>
                </ZoruButton>
              </div>
              <p className="break-all font-mono text-[11px] text-zoru-ink-muted">
                {a.miniAppUrl}
              </p>
            </ZoruCard>
          ))}
        </div>
      )}
    </div>
  );
}
