'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSmsCampaign, launchCampaign } from "@/app/actions/sms-campaign.actions";
import { useRouter } from "next/navigation";
// import { toast } from "sonner"; 
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

// Types need to be imported or defined shared. 
// For Wizard, we might fetch templates via a prop or separate server action inside useEffect?
// Best practice: Pass initial data (templates) as props to the Page, then to this component.

export default function SmsCampaignWizard({ templates }: { templates: any[] }) {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        templateId: '',
        audienceType: 'manual', // manual, csv, group
        manualNumbers: '', // comma separated tags or numbers
        mapping: {} as Record<string, string>
    });

    const currentTemplate = templates.find(t => t._id === formData.templateId);

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Basic validation
            if (!formData.name || !formData.templateId) {
                alert("Please fill in basic details");
                setLoading(false);
                return;
            }

            const audience = {
                type: formData.audienceType as any,
                value: formData.manualNumbers // Simplification for now
            };

            const result = await createSmsCampaign({
                name: formData.name,
                templateId: formData.templateId,
                mapping: formData.mapping,
                audience: audience
            });

            if (result.success) {
                // Auto launch for now or go to review? 
                // Let's assume we want to launch immediately if the user clicked "Launch"
                await launchCampaign(result.campaignId);
                alert("Campaign Created and Queued!");
                router.push('/dashboard/sms');
            }
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate vars from content
    // DLT vars are often {#var#}
    // We need to parse the template content to find them and generate inputs
    const getVariables = (content: string) => {
        const matches = content.match(/{#var#}/g);
        return matches ? matches.map((_, i) => `var${i + 1}`) : [];
    };

    const variables = currentTemplate ? getVariables(currentTemplate.content) : [];

    return (
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
            <div className="mb-8 flex justify-between items-center px-4">
                {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex items-center ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mr-2 ${s <= step ? 'border-primary bg-primary text-primary-foreground' : 'border-current'}`}>
                            {s < step ? <Check className="w-4 h-4" /> : s}
                        </div>
                        <span className="text-sm font-medium hidden sm:block">
                            {s === 1 ? 'Details & Audience' : s === 2 ? 'Template & Content' : 'Preview & Launch'}
                        </span>
                        {s < 3 && <div className={`h-[2px] w-12 mx-4 ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {step === 1 && "Campaign Details"}
                        {step === 2 && "Template Configuration"}
                        {step === 3 && "Review Summary"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {step === 1 && (
                        <>
                            <div className="space-y-2">
                                <Label>Campaign Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Diwali Sale Blast"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Audience Source</Label>
                                <Select
                                    value={formData.audienceType}
                                    onValueChange={v => setFormData({ ...formData, audienceType: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual Input (Paste Numbers)</SelectItem>
                                        <SelectItem value="csv">Paste CSV Content</SelectItem>
                                        <SelectItem value="group">Contact Group / Tag</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.audienceType === 'manual' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Phone Numbers</Label>
                                    <Textarea
                                        placeholder="919876543210, 919988776655"
                                        value={formData.manualNumbers}
                                        onChange={e => setFormData({ ...formData, manualNumbers: e.target.value })}
                                        className="h-32 font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">Comma separated, include country code.</p>
                                </div>
                            )}
                            {formData.audienceType === 'csv' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Paste CSV Content</Label>
                                    <Textarea
                                        placeholder="919876543210\n919988776655"
                                        value={formData.manualNumbers}
                                        onChange={e => setFormData({ ...formData, manualNumbers: e.target.value })}
                                        className="h-32 font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">Paste your list of numbers (one per line or comma separated).</p>
                                </div>
                            )}
                            {formData.audienceType === 'group' && (
                                <div className="space-y-2 animate-in fade-in">
                                    <Label>Group or Tag Name</Label>
                                    <Input
                                        placeholder="e.g. 'VIP Customers'"
                                        value={formData.manualNumbers}
                                        onChange={e => setFormData({ ...formData, manualNumbers: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">Type the exact name of the Contact Group or Tag.</p>
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div className="space-y-2">
                                <Label>Select DLT Template</Label>
                                <Select
                                    value={formData.templateId}
                                    onValueChange={v => setFormData({ ...formData, templateId: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map(t => (
                                            <SelectItem key={t._id} value={t._id}>{t.name} ({t.headerId})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {currentTemplate && (
                                <div className="bg-muted p-4 rounded-md space-y-4 animate-in fade-in">
                                    <p className="whitespace-pre-wrap text-sm">{currentTemplate.content}</p>

                                    {variables.length > 0 && (
                                        <div className="border-t pt-4">
                                            <Label className="mb-2 block">Variable Mapping</Label>
                                            <div className="grid gap-3">
                                                {variables.map((v, i) => (
                                                    <div key={v} className="grid grid-cols-3 items-center gap-2">
                                                        <Label className="text-xs text-muted-foreground">{'#var#'} (Pos {i + 1})</Label>
                                                        <Input
                                                            placeholder="Static value or CSV column"
                                                            className="col-span-2 h-8"
                                                            value={formData.mapping[i] || ''}
                                                            onChange={e => {
                                                                const newMapping = { ...formData.mapping };
                                                                newMapping[i] = e.target.value;
                                                                setFormData({ ...formData, mapping: newMapping });
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Name:</span>
                                    <p className="font-medium">{formData.name}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Audience:</span>
                                    <p className="font-medium">{formData.audienceType === 'manual' ? `${formData.manualNumbers.split(',').length} Numbers` : 'Configured'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Template:</span>
                                    <p className="font-medium">{currentTemplate?.name}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Cost Est:</span>
                                    <p className="font-medium">₹ {(formData.manualNumbers.split(',').length * 0.25).toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                                <Label className="text-primary mb-2 block">Preview</Label>
                                <p className="text-sm">
                                    {currentTemplate?.content.replace(/{#var#}/g, () => {
                                        return "{...}";
                                    })}
                                    {/* Better preview logic: split by {#var#} and interleave mapping values */}
                                    {currentTemplate?.content.split('{#var#}').map((part: string, i: number, arr: string[]) => (
                                        <span key={i}>
                                            {part}
                                            {i < arr.length - 1 && (
                                                <span className="bg-yellow-100 font-bold px-1 rounded text-yellow-800">
                                                    {formData.mapping[i] || '{var}'}
                                                </span>
                                            )}
                                        </span>
                                    ))}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleBack} disabled={step === 1 || loading}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 3 ? (
                        <Button onClick={handleNext} disabled={!formData.name}>
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Launch Campaign
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
