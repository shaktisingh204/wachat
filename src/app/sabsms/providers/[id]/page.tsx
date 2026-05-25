"use client";

import * as React from "react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";
import {
  Card,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  Button,
  Input,
  Label,
  Switch,
  Badge,
  Separator,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/zoruui";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

export default function ProviderConfigPage({ params }: { params: { id: string } }) {
  const providerId = params.id;

  const [isRevealed, setIsRevealed] = React.useState(false);
  const [showAuthDialog, setShowAuthDialog] = React.useState(false);
  const [password, setPassword] = React.useState("");

  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<"idle" | "success" | "error">("idle");

  const handleReveal = () => {
    // In a real application, verify the password with the backend
    if (password) {
      setIsRevealed(true);
      setShowAuthDialog(false);
      setPassword("");
    }
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestResult("idle");
    setTimeout(() => {
      setIsTesting(false);
      setTestResult("success");
    }, 1500);
  };

  return (
    <SabsmsPageShell
      title={`Provider: ${providerId}`}
      eyebrow="Infrastructure"
      description="Manage provider credentials, routing rules, and engine capacity limits."
      breadcrumbs={[
        { label: "Providers", href: "/sabsms/providers" },
        { label: providerId },
      ]}
      primaryAction={{ label: "Save Configuration" }}
      secondaryActions={[
        { label: "Disable Provider", destructive: true },
      ]}
      helpTitle="Provider Configuration"
      helpBody="Configure how SabSMS connects to this upstream provider. Changing rate limits or credentials will take effect immediately across all active engine workers."
    >
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          {/* 1 & 8: Credentials & Sender-ID Whitelist */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Credentials & Identity</ZoruCardTitle>
              <ZoruCardDescription>
                1. Provider-specific credential form & 8. Sender-id whitelist
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Account SID / Username</Label>
                <Input defaultValue="AC1234567890abcdef" />
              </div>
              <div className="grid gap-2">
                <Label>Auth Token / Secret</Label>
                <div className="flex gap-2">
                  <Input 
                    type={isRevealed ? "text" : "password"} 
                    defaultValue={isRevealed ? "real_secret_token_abc123" : "••••••••••••••••"} 
                    readOnly={!isRevealed}
                    className="flex-1"
                  />
                  {isRevealed ? (
                    <Button variant="outline" onClick={() => setIsRevealed(false)}>
                      <EyeOff className="w-4 h-4 mr-2" /> Hide
                    </Button>
                  ) : (
                    <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Eye className="w-4 h-4 mr-2" /> Reveal
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Authentication Required</DialogTitle>
                          <DialogDescription>
                            Please enter your admin password to reveal sensitive credentials.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label>Password</Label>
                          <Input 
                            type="password" 
                            placeholder="Enter password..." 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAuthDialog(false)}>Cancel</Button>
                          <Button onClick={handleReveal}>Authenticate</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
              
              <div className="flex justify-start pt-2">
                <Button variant="secondary" onClick={handleTestConnection} disabled={isTesting}>
                  {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (
                    testResult === "success" ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> : null
                  )}
                  {isTesting ? "Verifying..." : testResult === "success" ? "Verified" : "Verify Credentials"}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Sender-ID Whitelist</Label>
                  <div className="text-sm text-slate-500">
                    Restrict outbound alphas (Feature 8).
                  </div>
                </div>
                <Input placeholder="SABSMS, ALERT, OTP" className="max-w-[200px]" />
              </div>
            </ZoruCardContent>
          </Card>

          {/* 2, 3, 4, 5: Webhooks & Testing */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Webhooks & Testing</ZoruCardTitle>
              <ZoruCardDescription>Verify connectivity and validate signatures.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Webhook Signature Secret</Label>
                  <div className="text-sm text-slate-500">
                    5. Used to verify incoming requests.
                  </div>
                </div>
                <Button variant="outline" size="sm">Rotate Secret</Button>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <Button variant="secondary" className="w-full">2. Test Send</Button>
                <Button variant="secondary" className="w-full">3. Test Inbound Echo</Button>
                <Button variant="secondary" className="w-full">4. Test DLR Echo</Button>
              </div>
            </ZoruCardContent>
          </Card>

          {/* 7, 13, 14, 15, 16, 17: Capacity & Flow Control */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Capacity & Flow Control</ZoruCardTitle>
              <ZoruCardDescription>Engine-side rate limits and concurrency.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>7. Rate Limit (Req/s)</Label>
                  <Input type="number" defaultValue={100} />
                </div>
                <div className="space-y-2">
                  <Label>13. Send-Rate Cap (Msg/s)</Label>
                  <Input type="number" defaultValue={50} />
                </div>
                <div className="space-y-2">
                  <Label>14. Concurrent Job Cap</Label>
                  <Input type="number" defaultValue={20} />
                </div>
                <div className="space-y-2">
                  <Label>17. Region Pinning</Label>
                  <Input defaultValue="us-east-1" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>15. Provider Timeouts (ms)</Label>
                  <Input type="number" defaultValue={5000} />
                </div>
                <div className="space-y-2">
                  <Label>16. Retry Policy</Label>
                  <Input defaultValue="Exponential (Max 3)" />
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          {/* 9, 10, 12: Cost & Capabilities */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Provider Capabilities</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>10. Lookup API (HLR)</Label>
                  <div className="text-sm text-slate-500">Enable number validation (adds cost).</div>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>9. Number Purchase Delegation</Label>
                  <div className="text-sm text-slate-500">Allow engine to provision numbers automatically.</div>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="space-y-2 pt-2">
                <Label>12. Channel Toggles</Label>
                <div className="flex gap-2">
                  <Badge variant="default">SMS (Active)</Badge>
                  <Badge variant="secondary">MMS (Disabled)</Badge>
                  <Badge variant="secondary">RCS (Not Configured)</Badge>
                </div>
              </div>
            </ZoruCardContent>
          </Card>

          {/* 6. Pricing Table */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>6. Per-Country Pricing</ZoruCardTitle>
              <ZoruCardDescription>Read-only sync from provider API.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <div className="border rounded-md p-4 text-sm text-slate-600 bg-slate-50">
                <div className="flex justify-between font-medium border-b pb-2 mb-2">
                  <span>Country</span>
                  <span>Outbound SMS</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>United States (+1)</span>
                  <span>$0.0079</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>United Kingdom (+44)</span>
                  <span>$0.0420</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>India (+91)</span>
                  <span>$0.0022 (DLT)</span>
                </div>
              </div>
            </ZoruCardContent>
          </Card>
        </div>

        <div className="md:col-span-4 space-y-6">
          {/* 11. Default Sender */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Routing Defaults</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="space-y-2">
                <Label>11. Default Sender</Label>
                <Input defaultValue="+1234567890" />
              </div>
            </ZoruCardContent>
          </Card>

          {/* 18, 19, 20: Status & Engine info */}
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Engine Status & Logs</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">18. SDK Version</Label>
                <div className="font-mono text-sm">sabsms-engine/1.4.2 (Rust)</div>
              </div>
              <Separator />
              <Button variant="outline" className="w-full">
                19. View Connection Log (100)
              </Button>
              <Button variant="ghost" className="w-full text-slate-600">
                20. View Audit Trail
              </Button>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </SabsmsPageShell>
  );
}
