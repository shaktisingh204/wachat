import { NextResponse } from 'next/server';

/**
 * Public invoice PDF download — STUB.
 *
 * TODO(public-portal): generate a real PDF using the existing dashboard
 * invoice renderer (likely via puppeteer or a server-side React PDF
 * pipeline) once the renderer is extracted into a shared helper.
 * For now this returns 501 so the UI can wire to the route without
 * leaking auth-protected fetches.
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    { error: 'PDF generation not implemented yet.' },
    { status: 501 },
  );
}
