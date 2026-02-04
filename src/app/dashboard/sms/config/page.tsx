import { getSmsConfig } from "@/app/actions/sms-config.actions";
import { ProviderConfigForm } from "@/components/wabasimplify/sms/provider-config-form";

export default async function SmsConfigPage() {
    const config = await getSmsConfig();

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h3 className="text-lg font-medium">SMS Provider Configuration</h3>
                <p className="text-sm text-muted-foreground">
                    Configure your preferred SMS gateway. Connect one of 20+ supported providers.
                </p>
            </div>

            <ProviderConfigForm initialConfig={config} />
        </div>
    );
}
