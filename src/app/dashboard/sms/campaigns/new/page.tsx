
import { getDltTemplates } from "@/app/actions/sms-template.actions";
import SmsCampaignWizard from "./wizard";

export default async function NewSmsCampaignPage() {
    const templates = await getDltTemplates();

    return <SmsCampaignWizard templates={templates} />;
}
