import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const response = NextResponse.redirect(new URL('/admin-login', request.url));
    
    // Clear the admin session cookie
    response.cookies.delete('admin_session');
    
    return response;
}

