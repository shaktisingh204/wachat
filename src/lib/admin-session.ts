import 'server-only';
import { cookies } from 'next/headers';
import { verifyAdminJwt } from '@/lib/auth';

/**
 * Reads the admin session from the request cookie.
 * This is NOT a server action — it's a plain server-side utility so that
 * Next.js can trace the cookies() call and correctly opt routes into
 * dynamic rendering.
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
