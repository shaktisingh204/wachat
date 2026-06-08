/**
 * Iframe-friendly chat shell loaded by `/public/embed/widget.js`.
 *
 * Reuses the existing SabFlow chat component so we don't fork the chat UI.
 * Renders with no app chrome (no header, no nav, no global layout) and
 * lets a small client island handle postMessage signalling to the host.
 */

import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { WidgetConfig } from '@/lib/embed/types';
import EmbedClient from './EmbedClient';
import { UnavailableWidget } from './components/UnavailableWidget';

export const dynamic = 'force-dynamic';

interface WidgetDocument {
  _id: ObjectId;
  id?: string;
  workspaceId?: string;
  name?: string;
  flowId?: string;
  allowedOrigins?: string[];
  theme?: WidgetConfig['theme'];
  greeting?: string;
  enabled?: boolean;
  locale?: string;
}

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
    const doc = await db.collection<WidgetDocument>('embed_widgets').findOne(query);
    if (!doc) return null;
    return {
      id: String(doc.id ?? doc._id),
      workspaceId: String(doc.workspaceId ?? ''),
      name: String(doc.name ?? 'SabNode'),
      flowId: doc.flowId,
      allowedOrigins: doc.allowedOrigins ?? [],
      theme: doc.theme,
      greeting: doc.greeting,
      enabled: doc.enabled !== false,
      locale: doc.locale,
    } satisfies WidgetConfig;
  } catch (error) {
    console.error('[embed/chat] failed to load widget', error);
    throw new Error('Failed to load widget configuration.');
  }

}

export default async function EmbedChatPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  // Mark dynamic: origin is checked in the API; the page itself is per-widget.
  await headers();

  const widget = await loadWidget(params.id);

  const localeParam =
    typeof searchParams.locale === 'string' ? searchParams.locale : undefined;

  if (!widget || !widget.enabled) {
    return <UnavailableWidget />;
  }


  const primary = widget.theme?.primary ?? '#111827';
  const fontFamily =
    widget.theme?.fontFamily ??
    'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  return (
    <main
      className="20ui m-0 flex h-screen flex-col p-0"
      style={{
        background: widget.theme?.background ?? '#ffffff',
        color: widget.theme?.foreground ?? '#0f172a',
        fontFamily,
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
