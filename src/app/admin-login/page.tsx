import "@/styles/zoruui.css";
import { isAdminConfigured } from '@/app/actions/admin.actions';
import AdminLoginClient from './admin-login-client';

export default async function AdminLoginPage() {
    let configured = true;
    try {
        configured = await isAdminConfigured();
    } catch {
        configured = true; // Fallback to login on error
    }

    return (
        <div className="zoruui min-h-screen bg-zinc-950 text-zinc-100">
            <AdminLoginClient initialMode={configured ? 'login' : 'setup'} />
        </div>
    );
}
