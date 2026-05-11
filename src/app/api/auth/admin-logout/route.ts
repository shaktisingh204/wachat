
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { rustClient, RustApiError } from '@/lib/rust-client';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
    const token = request.cookies.get('admin_session')?.value;

    if (token) {
        try {
            const { payload } = await jwtVerify(token, getJwtSecretKey());
            if (payload.jti && payload.exp) {
                // Forward the revocation to the Rust backend's deny-list.
                // expSeconds is the absolute unix timestamp the token expires at;
                // Rust uses it to TTL the deny-list entry.
                await rustClient.admin.auth.logoutRevoke({
                    jti: String(payload.jti),
                    expSeconds: Number(payload.exp),
                });
                console.log(`[ADMIN-LOGOUT] Revoked admin token JTI: ${payload.jti}`);
            }
        } catch (error) {
            if (error instanceof RustApiError) {
                console.error(
                    `[ADMIN-LOGOUT] Rust revoke failed (${error.status}):`,
                    error.message,
                );
            } else {
                console.error('Error revoking admin token during logout:', error);
            }
            // Fall through: we still want to clear the cookie even if the
            // backend revoke fails, otherwise the user gets stuck.
        }
    }

    const response = NextResponse.redirect(new URL('/admin-login', request.url));

    // Clear the admin session cookie
    response.cookies.delete('admin_session');

    return response;
}
