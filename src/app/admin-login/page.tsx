import { isAdminConfigured } from '@/app/actions/admin.actions';
import AdminLoginClient from './admin-login-client';

export default async function AdminLoginPage() {
    let configured = true;
    try {
        configured = await isAdminConfigured();
    } catch {
        configured = true; // Fallback to login on error
    }

    return <AdminLoginClient initialMode={configured ? 'login' : 'setup'} />;
}
