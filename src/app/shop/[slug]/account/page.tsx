
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountDashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">My Account</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Welcome back, Customer!</CardTitle>
                    <CardDescription>
                        From your account dashboard you can view your recent orders, manage your shipping and billing addresses, and edit your password and account details.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>This is your main account dashboard. Navigation links are on the left.</p>
                </CardContent>
            </Card>
        </div>
    );
}
