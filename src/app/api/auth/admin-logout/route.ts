import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const response = NextResponse.redirect(new URL('/admin-login', request.url));
    
    // The most secure and reliable way to "log out" is to clear the session cookie.
    cookies().set({
        name: 'admin_session',
        value: '',
        path: '/',
        expires: new Date(0),
    });
    
    return response;
}
