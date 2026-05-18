/**
 * POST /api/sabflow/marketplace/install
 *
 * Phase C.10 · sub-task #6 — one-click template install.
 *
 * Body:    { templateSlug: string }
 *
 * Response shapes:
 *   • 200 { status: 'needs_credentials', missing: CredentialType[],
 *           required: CredentialType[], templateSlug: string }
 *     The caller must add the listed credential types and re-submit.
 *
 *   • 201 { status: 'ok', flowId: string, editorUrl: string,
 *           installCount: number | null }
 *     The flow is cloned; the UI should `router.push(editorUrl)`.
 *
 *   • 401 { error }  not authenticated
 *   • 404 { error }  template slug not found / not published
 *   • 400 { error }  malformed body
 *   • 500 { error }  unexpected
 *
 * Internals:
 *   - Cross-tenant safety: `installMarketplaceTemplate` stamps the cloned
 *     `SabFlowDoc.userId` from the *server-side* session — never trust a
 *     client-supplied workspace id.
 *   - Re-uses the Phase B.5 §9 import path under the hood (`remapFlowIds`
 *     in `marketplace/install.ts` mirrors the same id-remap logic that
 *     `/api/sabflow/import` uses).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { installMarketplaceTemplate } from '@/lib/sabflow/marketplace/install';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface InstallBody {
  templateSlug?: unknown;
}

export async function POST(request: NextRequest) {
  /* ── Auth ────────────────────────────────────────────────────────────── */
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    );
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  /* ── Parse body ─────────────────────────────────────────────────────── */
  let body: InstallBody;
  try {
    body = (await request.json()) as InstallBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const templateSlug =
    typeof body.templateSlug === 'string' ? body.templateSlug.trim() : '';
  if (!templateSlug) {
    return NextResponse.json(
      { error: '`templateSlug` is required' },
      { status: 400 },
    );
  }

  /* ── Run install ────────────────────────────────────────────────────── */
  try {
    const result = await installMarketplaceTemplate({
      templateSlug,
      userId,
      workspaceId: userId,
    });

    switch (result.status) {
      case 'not_found':
        return NextResponse.json(
          { error: 'Template not found or not published' },
          { status: 404 },
        );

      case 'needs_credentials':
        return NextResponse.json(
          {
            status: 'needs_credentials',
            templateSlug: result.templateSlug,
            missing: result.missing,
            required: result.required,
          },
          { status: 200 },
        );

      case 'ok':
        return NextResponse.json(
          {
            status: 'ok',
            flowId: result.flowId,
            editorUrl: result.editorUrl,
            installCount: result.installCount,
          },
          { status: 201 },
        );

      default:
        return NextResponse.json(
          { error: 'Unexpected install result' },
          { status: 500 },
        );
    }
  } catch (err) {
    console.error('[SABFLOW MARKETPLACE INSTALL] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
