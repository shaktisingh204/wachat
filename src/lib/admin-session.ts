import 'server-only';
import { cookies } from 'next/headers';
import { rustClient, RustApiError } from '@/lib/rust-client';

/**
 * Read and verify the admin session from the request cookie.
 *
 * The verification — JWT signature, expiry, role check, revoked-jti lookup —
 * runs on the Rust backend (`POST /v1/admin/session/verify`). The TS side
 * only handles the cookie store; the secret never leaves the Rust process.
 *
 * Failures of any kind (missing cookie, invalid signature, expired, wrong
 * role, revoked, Rust unreachable) collapse to `{ isAdmin: false }` so the
 * caller can render the login page without a try/catch.
 */
export async function getAdminSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return { isAdmin: false as const };

    try {
        const res = await rustClient.admin.auth.verifySession(token);
        if (!res.isAdmin || !res.user) {
            return { isAdmin: false as const };
        }
        return { isAdmin: true as const, user: res.user };
    } catch (e) {
        if (e instanceof RustApiError) {
            return { isAdmin: false as const };
        }
        throw e;
    }
}
