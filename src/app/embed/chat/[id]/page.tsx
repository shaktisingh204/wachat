/**
 * Iframe-friendly chat shell loaded by `/public/embed/widget.js`.
 *
 * Reuses the existing SabFlow chat component so we don't fork the chat UI.
 * Renders with no app chrome — no header, no nav, no global layout — and
 * lets a small client island handle postMessage signalling to the host.
 */

import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { WidgetConfig } from '@/lib/embed/types';
import EmbedClient from './EmbedClient';

export const dynamicParams = true;
export const revalidate = 0;

async function loadWidget(id: string): Promise<WidgetConfig | null> {
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { id };
    if (ObjectId.isValid(id)) {
      const or = [{ id }, { _id: new ObjectId(id) }];
      delete query.id;
      (query as { $or?: unknown }).$or = or;
    }
    const doc = await db.collection('embed_widgets').findOne(query as never);
    if (!doc) return null;
    const d = doc as unknown as Record<string, unknown>;
    return {
      id: String(d.id ?? doc._id),
      workspaceId: String(d.workspaceId ?? ''),
      name: String(d.name ?? 'SabNode'),
      flowId: d.flowId as string | undefined,
      allowedOrigins: (d.allowedOrigins as string[] | undefined) ?? [],
      theme: d.theme as WidgetConfig['theme'],
      greeting: d.greeting as string | undefined,
      enabled: d.enabled !== false,
      locale: d.locale as string | undefined,
    } satisfies WidgetConfig;
  } catch (error) {
    console.error('[embed/chat] failed to load widget', error);
    return null;
  }
}

export default async function EmbedChatPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  // Mark dynamic — origin is checked in the API; the page itself is per-widget.
  await headers();

  const widget = await loadWidget(params.id);

  const localeParam =
    typeof searchParams.locale === 'string' ? searchParams.locale : undefined;

  if (!widget || !widget.enabled) {
    return (
      <main
        style={{
          margin: 0,
          padding: 24,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: '#111',
          background: '#fff',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Chat unavailable
          </h1>
          <p style={{ fontSize: 13, color: '#555' }}>
            This widget is not currently enabled.
          </p>
        </div>
      </main>
    );
  }

  const primary = widget.theme?.primary ?? '#111827';
  const fontFamily =
    widget.theme?.fontFamily ??
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        height: '100vh',
        background: widget.theme?.background ?? '#ffffff',
        color: widget.theme?.foreground ?? '#0f172a',
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
      }}
      data-sabnode-widget={widget.id}
      data-sabnode-locale={localeParam ?? widget.locale ?? 'en'}
    >
      <EmbedClient
        flowId={widget.flowId}
        widgetName={widget.name}
        greeting={widget.greeting ?? 'How can we help?'}
        primaryColor={primary}
      />
    </main>
  );
}
