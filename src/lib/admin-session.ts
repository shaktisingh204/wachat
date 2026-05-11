import 'server-only';
import { cookies } from 'next/headers';
import { verifyAdminJwt } from '@/lib/auth';

/**
 * Read and verify the admin session from the request cookie.
 *
 * Verification runs in-process with `jose` against `JWT_SECRET` because
 * every admin page render needs the session — making Rust a hard dependency
 * for page rendering would log every admin out the moment the Rust binary
 * was unreachable.
 *
 * The Rust BFF *does* expose `POST /v1/admin/session/verify` for callers
 * that want centralised verification (cron workers, non-Node runtimes,
 * etc.); Next.js just doesn't use it for the request-time check.
 */
export async function getAdminSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return { isAdmin: false as const };

    const payload = await verifyAdminJwt(token);
    if (!payload || payload.role !== 'admin') {
        return { isAdmin: false as const };
    }

    return { isAdmin: true as const, user: payload };
}
