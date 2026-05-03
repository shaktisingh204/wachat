import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { signEmbed } from '@/lib/embed/sign';
import type { WidgetConfig } from '@/lib/embed/types';

export const dynamic = 'force-dynamic';

/** GET /api/embed/widgets/[id] — return widget config + HMAC signature. */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = { id };
    if (ObjectId.isValid(id)) {
      query.$or = [{ id }, { _id: new ObjectId(id) }];
      delete query.id;
    }

    const doc = await db.collection('embed_widgets').findOne(query as never);

    // Origin allowlist enforcement — refuse if the requesting origin is
    // not whitelisted. We're permissive when no origins configured (dev).
    const origin =
      request.headers.get('origin') || request.headers.get('referer') || '';
    const config: WidgetConfig | null = doc
      ? ({
          id: String((doc as { id?: string }).id ?? doc._id),
          workspaceId: String(
            (doc as { workspaceId?: string }).workspaceId ?? '',
          ),
          name: String((doc as { name?: string }).name ?? 'SabNode'),
          flowId: (doc as { flowId?: string }).flowId,
          allowedOrigins:
            (doc as { allowedOrigins?: string[] }).allowedOrigins ?? [],
          theme: (doc as { theme?: WidgetConfig['theme'] }).theme,
          greeting: (doc as { greeting?: string }).greeting,
          enabled: (doc as { enabled?: boolean }).enabled !== false,
          locale: (doc as { locale?: string }).locale,
          updatedAt: (doc as unknown as { updatedAt?: Date | string })
            .updatedAt
            ? new Date(
                (doc as unknown as { updatedAt: Date | string }).updatedAt,
              ).toISOString()
            : undefined,
        } satisfies WidgetConfig)
      : null;

    if (!config) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    if (
      origin &&
      config.allowedOrigins.length > 0 &&
      !config.allowedOrigins.some((o) =>
        origin.toLowerCase().startsWith(o.toLowerCase()),
      )
    ) {
      return NextResponse.json(
        { error: 'Origin not allowed' },
        { status: 403 },
      );
    }

    const secret = process.env.EMBED_SIGNING_SECRET || 'sabnode-dev-secret';
    const signature = await signEmbed(
      config as unknown as Record<string, unknown>,
      secret,
    );

    const res = NextResponse.json({ config, signature });
    res.headers.set(
      'Cache-Control',
      'public, max-age=30, stale-while-revalidate=120',
    );
    if (origin) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  } catch (error) {
    console.error('[embed/widgets] failed to load', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}
