"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  PhoneCall,
  MessageSquare,
  Image as ImageIcon,
  RefreshCcw,
  ShoppingCart,
  MapPin,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";
import type { SabsmsAvailableNumber } from "@/lib/sabsms/types";

import {
  searchAvailableNumbersAction,
  provisionNumberAction,
  registerSenderIdAction,
} from "./actions";

const COUNTRIES: Array<{ value: string; label: string }> = [
  { value: "US", label: "🇺🇸 United States (+1)" },
  { value: "CA", label: "🇨🇦 Canada (+1)" },
  { value: "GB", label: "🇬🇧 United Kingdom (+44)" },
  { value: "AU", label: "🇦🇺 Australia (+61)" },
  { value: "IN", label: "🇮🇳 India (+91)" },
];

function formatMonthlyCost(cents: number | null | undefined, currency?: string | null): string {
  if (cents === null || cents === undefined) return "—";
  const amount = (cents / 100).toFixed(2);
  const cur = currency ?? "USD";
  return cur === "USD" ? `$${amount}` : `${amount} ${cur}`;
}

const TYPE_LABELS: Record<string, string> = {
  longcode: "Longcode",
  tollfree: "Toll-free",
  mobile: "Mobile",
};

export default function BuyNumbersPage() {
  const router = useRouter();

  // Search state
  const [provider, setProvider] = useState<"twilio" | "telnyx">("twilio");
  const [country, setCountry] = useState("US");
  const [capSms, setCapSms] = useState(true);
  const [capMms, setCapMms] = useState(false);
  const [capVoice, setCapVoice] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<SabsmsAvailableNumber[]>([]);

  // Buy confirm state
  const [buyTarget, setBuyTarget] = useState<SabsmsAvailableNumber | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  // Sender ID registration state
  const [sidProvider, setSidProvider] = useState<"msg91" | "gupshup">("msg91");
  const [sidValue, setSidValue] = useState("");
  const [sidDltHeaderId, setSidDltHeaderId] = useState("");
  const [sidCountry, setSidCountry] = useState("IN");
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const capabilities = [
        ...(capSms ? ["sms"] : []),
        ...(capMms ? ["mms"] : []),
        ...(capVoice ? ["voice"] : []),
      ];
      const res = await searchAvailableNumbersAction({
        provider,
        country,
        ...(capabilities.length > 0 ? { capabilities } : {}),
      });
      setHasSearched(true);
      if (res.success) {
        setResults(res.numbers);
        if (res.numbers.length === 0) {
          toast.info("No numbers found matching your criteria.");
        }
      } else {
        setResults([]);
        toast.error(res.error);
      }
    } catch {
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleBuy = async () => {
    if (!buyTarget) return;
    setIsBuying(true);
    try {
      const res = await provisionNumberAction({
        provider,
        phoneNumber: buyTarget.phoneNumber,
      });
      if (res.success) {
        toast.success(`Provisioned ${res.e164}`, {
          action: { label: "View numbers", onClick: () => router.push("/sabsms/numbers") },
        });
        setBuyTarget(null);
        setResults((prev) => prev.filter((n) => n.phoneNumber !== buyTarget.phoneNumber));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to provision number.");
    } finally {
      setIsBuying(false);
    }
  };

  const handleRegisterSenderId = async () => {
    setIsRegistering(true);
    try {
      const res = await registerSenderIdAction({
        provider: sidProvider,
        senderId: sidValue,
        dltHeaderId: sidDltHeaderId.trim() || undefined,
        country: sidCountry,
      });
      if (res.success) {
        toast.success(`Sender ID ${res.senderId} registered`, {
          action: { label: "View numbers", onClick: () => router.push("/sabsms/numbers") },
        });
        setSidValue("");
        setSidDltHeaderId("");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to register sender ID.");
    } finally {
      setIsRegistering(false);
    }
  };

  const capChip = (label: string, on: boolean) => (
    <Badge variant={on ? "default" : "secondary"} className="text-[10px]">
      {label}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-[var(--st-bg)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Buy Numbers</h1>
          <p className="text-[var(--st-text-secondary)] mt-1">
            Search and provision phone numbers through your connected Twilio or Telnyx account.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/sabsms/numbers">Back to numbers</Link>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search available numbers</CardTitle>
          <CardDescription>
            Inventory is fetched live from the provider with your workspace credentials.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as "twilio" | "telnyx")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="telnyx">Telnyx</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Required capabilities</Label>
              <div className="flex flex-wrap gap-5 pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox id="cap-sms" checked={capSms} onChange={(e) => setCapSms(e.target.checked)} />
                  <label htmlFor="cap-sms" className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
                    SMS
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="cap-mms" checked={capMms} onChange={(e) => setCapMms(e.target.checked)} />
                  <label htmlFor="cap-mms" className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
                    MMS
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="cap-voice" checked={capVoice} onChange={(e) => setCapVoice(e.target.checked)} />
                  <label htmlFor="cap-voice" className="text-sm font-medium flex items-center gap-2">
                    <PhoneCall className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
                    Voice
                  </label>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter className="flex justify-end border-t border-[var(--st-border)] py-4">
          <Button onClick={handleSearch} disabled={isSearching} className="gap-2 min-w-[120px]">
            {isSearching ? (
              <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Search
          </Button>
        </CardFooter>
      </Card>

      {/* Results */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--st-border)] pb-4">
          <CardTitle className="text-lg">Available inventory</CardTitle>
          <CardDescription>
            {hasSearched
              ? `${results.length} result${results.length === 1 ? "" : "s"} from ${provider === "twilio" ? "Twilio" : "Telnyx"}.`
              : "Run a search to load live inventory."}
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Number</Th>
                <Th>Type</Th>
                <Th>Region</Th>
                <Th>Capabilities</Th>
                <Th className="text-right">Monthly cost</Th>
                <Th className="w-[100px]"></Th>
              </Tr>
            </THead>
            <TBody>
              {results.length === 0 ? (
                <Tr>
                  <Td colSpan={6} className="text-center h-32 text-[var(--st-text-secondary)]">
                    {isSearching
                      ? "Searching..."
                      : hasSearched
                        ? "No numbers found matching your criteria."
                        : "No results yet — choose a provider and country, then search."}
                  </Td>
                </Tr>
              ) : (
                results.map((item) => (
                  <Tr key={item.phoneNumber}>
                    <Td>
                      <div className="font-mono font-medium text-[var(--st-text)]">
                        {item.phoneNumber}
                      </div>
                      {item.friendlyName && (
                        <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">
                          {item.friendlyName}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <Badge variant="secondary" className="font-normal text-xs">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {item.region ?? "—"}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {capChip("SMS", item.capabilities.sms)}
                        {capChip("MMS", item.capabilities.mms)}
                        {capChip("RCS", item.capabilities.rcs)}
                        {capChip("Voice", item.capabilities.voice)}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <span className="font-medium">
                        {formatMonthlyCost(item.monthlyCost, item.currency)}
                      </span>
                    </Td>
                    <Td>
                      <Button size="sm" className="w-full gap-1" onClick={() => setBuyTarget(item)}>
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                        Buy
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      {/* Alphanumeric sender ID registration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-[var(--st-text)]" aria-hidden="true" />
            Register an alphanumeric sender ID (MSG91 / Gupshup)
          </CardTitle>
          <CardDescription>
            Sender IDs are approved by the provider (and DLT in India) — register the approved ID
            here so SabSMS can route sends with it.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label>Provider</Label>
              <Select value={sidProvider} onValueChange={(v) => setSidProvider(v as "msg91" | "gupshup")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="msg91">MSG91</SelectItem>
                  <SelectItem value="gupshup">Gupshup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="sid-value">Sender ID</Label>
              <Input
                id="sid-value"
                placeholder="e.g. SABSMS (3-11 alphanumeric)"
                value={sidValue}
                onChange={(e) => setSidValue(e.target.value)}
                maxLength={11}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="sid-dlt">DLT header ID (India)</Label>
              <Input
                id="sid-dlt"
                placeholder="Optional"
                value={sidDltHeaderId}
                onChange={(e) => setSidDltHeaderId(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Country</Label>
              <Select value={sidCountry} onValueChange={setSidCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardBody>
        <CardFooter className="flex justify-end border-t border-[var(--st-border)] py-4">
          <Button onClick={handleRegisterSenderId} disabled={isRegistering || !sidValue.trim()}>
            {isRegistering ? "Registering..." : "Register sender ID"}
          </Button>
        </CardFooter>
      </Card>

      {/* Buy confirm dialog */}
      <Dialog open={!!buyTarget} onOpenChange={(open) => { if (!open) setBuyTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm purchase</DialogTitle>
            <DialogDescription>
              Provision {buyTarget?.phoneNumber} via{" "}
              {provider === "twilio" ? "Twilio" : "Telnyx"}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--st-text-secondary)]">Monthly cost</span>
              <span className="font-medium">
                {formatMonthlyCost(buyTarget?.monthlyCost, buyTarget?.currency)}
              </span>
            </div>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Billed monthly by the provider to your connected account.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyTarget(null)} disabled={isBuying}>
              Cancel
            </Button>
            <Button onClick={handleBuy} disabled={isBuying} className="gap-2">
              {isBuying ? (
                <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              )}
              {isBuying ? "Provisioning..." : "Confirm purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
