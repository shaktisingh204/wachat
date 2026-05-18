import { ZoruPageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription } from '@/components/zoruui';
import {
  getSmsConfig } from "@/app/actions/sms-config.actions";
import { ProviderConfigForm } from "@/components/wabasimplify/sms/provider-config-form";

export default async function SmsConfigPage() {
    const config = await getSmsConfig();

    return (
        <div className="space-y-6 max-w-4xl">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>SMS Provider Configuration</ZoruPageTitle>
                    <ZoruPageDescription>
                        Configure your preferred SMS gateway. Connect one of 20+ supported providers.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>

            <ProviderConfigForm initialConfig={config} />
        </div>
    );
}
