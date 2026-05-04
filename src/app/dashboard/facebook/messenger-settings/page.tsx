"use client";

/**
 * /dashboard/facebook/messenger-settings — ZoruUI rebuild.
 *
 * Same server-action wiring as the legacy page:
 *   - getMessengerProfile / setMessengerGreeting / setMessengerGetStarted
 *   - setMessengerIceBreakers / setWhitelistedDomains
 *   - getSavedResponses / createSavedResponse / deleteSavedResponse
 *   - getMessagingFeatureReview
 *
 * Visual layer fully Zoru: no clay-*, no @/components/ui/*, no tabs.
 */

import * as React from "react";
import { useEffect, useState, useTransition, useCallback } from "react";
import {
  CheckCircle,
  Globe,
  MessageCircleQuestion,
  MessageSquare,
  Plus,
  Save,
  Snowflake,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  createSavedResponse,
  deleteSavedResponse,
  getMessagingFeatureReview,
  getMessengerProfile,
  getSavedResponses,
  setMessengerGetStarted,
  setMessengerGreeting,
  setMessengerIceBreakers,
  setWhitelistedDomains,
} from "@/app/actions/facebook.actions";

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

import {
  FbBreadcrumb,
  FbErrorAlert,
  FbHeader,
  FbNoProject,
} from "../_components/zoru-fb-page-shell";

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-end justify-between">
        <ZoruSkeleton className="h-9 w-72" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </div>
  );
}

interface IceBreaker {
  question: string;
  payload: string;
}

export default function MessengerSettingsPage() {
  const { toast } = useZoruToast();

  const [profile, setProfile] = useState<any>(null);
  const [savedResponses, setSavedResponses] = useState<any[]>([]);
  const [features, setFeatures] = useState<
    { feature: string; status: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);

  const [greetingText, setGreetingText] = useState("");
  const [getStartedPayload, setGetStartedPayload] = useState("");
  const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([
    { question: "", payload: "" },
  ]);
  const [domains, setDomains] = useState<string[]>([""]);
  const [newResponseTitle, setNewResponseTitle] = useState("");
  const [newResponseMessage, setNewResponseMessage] = useState("");

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const [profileRes, responsesRes, featuresRes] = await Promise.all([
        getMessengerProfile(projectId),
        getSavedResponses(projectId),
        getMessagingFeatureReview(projectId),
      ]);

      if (profileRes.error) {
        setError(profileRes.error);
      } else if (profileRes.profile) {
        setProfile(profileRes.profile);
        const p = profileRes.profile;
        if (p.greeting?.[0]?.text) setGreetingText(p.greeting[0].text);
        if (p.get_started?.payload) setGetStartedPayload(p.get_started.payload);
        if (p.ice_breakers?.length > 0) {
          setIceBreakers(
            p.ice_breakers.map((ib: any) => ({
              question:
                ib.call_to_actions?.[0]?.question || ib.question || "",
              payload: ib.call_to_actions?.[0]?.payload || ib.payload || "",
            })),
          );
        }
        if (p.whitelisted_domains?.length > 0) {
          setDomains(p.whitelisted_domains);
        }
      }

      if (responsesRes.responses) setSavedResponses(responsesRes.responses);
      if (featuresRes.features) setFeatures(featuresRes.features);
    });
  }, [projectId]);

  useEffect(() => {
    const stored = localStorage.getItem("activeProjectId");
    setProjectId(stored);
  }, []);

  useEffect(() => {
    fetchData();
  }, [projectId, fetchData]);

  const handleSaveGreeting = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const result = await setMessengerGreeting(projectId, greetingText);
      if (result.error) {
        setError(result.error);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Saved", description: "Greeting text updated." });
      }
    });
  };

  const handleSaveGetStarted = () => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const result = await setMessengerGetStarted(projectId, getStartedPayload);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Saved",
          description: "Get-started payload updated.",
        });
      }
    });
  };

  const handleSaveIceBreakers = () => {
    if (!projectId) return;
    const valid = iceBreakers.filter((ib) => ib.question && ib.payload);
    if (valid.length === 0) {
      toast({
        title: "Add at least one ice breaker",
        description: "Both question and payload are required.",
        variant: "destructive",
      });
      return;
    }
    startSaveTransition(async () => {
      const result = await setMessengerIceBreakers(projectId, valid);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Saved", description: "Ice breakers updated." });
      }
    });
  };

  const handleSaveDomains = () => {
    if (!projectId) return;
    const valid = domains.filter((d) => d.trim());
    if (valid.length === 0) {
      toast({
        title: "Add at least one domain",
        description: "Whitelisted-domain list cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    startSaveTransition(async () => {
      const result = await setWhitelistedDomains(projectId, valid);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Saved",
          description: "Whitelisted domains updated.",
        });
      }
    });
  };

  const handleAddSavedResponse = () => {
    if (!projectId || !newResponseTitle || !newResponseMessage) return;
    startSaveTransition(async () => {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("title", newResponseTitle);
      fd.append("message", newResponseMessage);
      const result = await createSavedResponse(
        { message: undefined, error: undefined },
        fd,
      );
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setNewResponseTitle("");
        setNewResponseMessage("");
        toast({ title: "Saved", description: "Saved response added." });
        fetchData();
      }
    });
  };

  const handleDeleteResponse = (responseId: string) => {
    if (!projectId) return;
    startSaveTransition(async () => {
      const result = await deleteSavedResponse(responseId, projectId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({ title: "Removed", description: "Saved response deleted." });
        fetchData();
      }
    });
  };

  if (isLoading && !profile) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <FbBreadcrumb page="Messenger Settings" />
      <FbHeader
        title="Messenger Settings"
        description="Configure Messenger profile, greeting, ice breakers, whitelisted domains and saved responses."
      />

      {!projectId ? (
        <FbNoProject />
      ) : error ? (
        <FbErrorAlert message={error} />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Greeting */}
          <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink">
              <MessageSquare className="h-4 w-4" />
              <h2 className="text-[14px]">Greeting text</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Shown to first-time visitors before they message your page.
            </p>
            <div className="mt-3 space-y-3">
              <ZoruTextarea
                value={greetingText}
                onChange={(e) => setGreetingText(e.target.value)}
                placeholder="Hi {{user_first_name}}! Welcome to our page."
                rows={3}
              />
              <ZoruButton
                size="sm"
                onClick={handleSaveGreeting}
                disabled={isSaving}
              >
                <Save /> Save greeting
              </ZoruButton>
            </div>
          </ZoruCard>

          {/* Get Started */}
          <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink">
              <MessageCircleQuestion className="h-4 w-4" />
              <h2 className="text-[14px]">Get-started button</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Custom payload sent when a user taps the Get Started CTA.
            </p>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <ZoruLabel htmlFor="fb-get-started-payload">Payload</ZoruLabel>
                <ZoruInput
                  id="fb-get-started-payload"
                  value={getStartedPayload}
                  onChange={(e) => setGetStartedPayload(e.target.value)}
                  placeholder="GET_STARTED_PAYLOAD"
                />
              </div>
              <ZoruButton
                size="sm"
                onClick={handleSaveGetStarted}
                disabled={isSaving}
              >
                <Save /> Save payload
              </ZoruButton>
            </div>
          </ZoruCard>

          {/* Ice Breakers */}
          <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink">
              <Snowflake className="h-4 w-4" />
              <h2 className="text-[14px]">Ice breakers</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Quick prompts users can pick to start a conversation.
            </p>
            <div className="mt-3 space-y-3">
              {iceBreakers.map((ib, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <ZoruInput
                    value={ib.question}
                    onChange={(e) => {
                      const updated = [...iceBreakers];
                      updated[i] = { ...updated[i], question: e.target.value };
                      setIceBreakers(updated);
                    }}
                    placeholder="Question"
                  />
                  <div className="flex gap-1">
                    <ZoruInput
                      value={ib.payload}
                      onChange={(e) => {
                        const updated = [...iceBreakers];
                        updated[i] = {
                          ...updated[i],
                          payload: e.target.value,
                        };
                        setIceBreakers(updated);
                      }}
                      placeholder="Payload"
                    />
                    {iceBreakers.length > 1 && (
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setIceBreakers(
                            iceBreakers.filter((_, j) => j !== i),
                          )
                        }
                        aria-label="Remove ice breaker"
                      >
                        <Trash2 />
                      </ZoruButton>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setIceBreakers([
                      ...iceBreakers,
                      { question: "", payload: "" },
                    ])
                  }
                >
                  <Plus /> Add
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  onClick={handleSaveIceBreakers}
                  disabled={isSaving}
                >
                  <Save /> Save
                </ZoruButton>
              </div>
            </div>
          </ZoruCard>

          {/* Whitelisted Domains */}
          <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink">
              <Globe className="h-4 w-4" />
              <h2 className="text-[14px]">Whitelisted domains</h2>
            </div>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Domains your Messenger features (like webview/checkout) can open.
            </p>
            <div className="mt-3 space-y-3">
              {domains.map((domain, i) => (
                <div key={i} className="flex gap-1">
                  <ZoruInput
                    value={domain}
                    onChange={(e) => {
                      const updated = [...domains];
                      updated[i] = e.target.value;
                      setDomains(updated);
                    }}
                    placeholder="https://example.com"
                  />
                  {domains.length > 1 && (
                    <ZoruButton
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setDomains(domains.filter((_, j) => j !== i))
                      }
                      aria-label="Remove domain"
                    >
                      <Trash2 />
                    </ZoruButton>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setDomains([...domains, ""])}
                >
                  <Plus /> Add
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  onClick={handleSaveDomains}
                  disabled={isSaving}
                >
                  <Save /> Save
                </ZoruButton>
              </div>
            </div>
          </ZoruCard>

          {/* Saved Responses */}
          <ZoruCard className="p-5 md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] text-zoru-ink">Saved responses</h2>
                <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                  Reusable replies your team can pick from in the inbox.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <ZoruInput
                value={newResponseTitle}
                onChange={(e) => setNewResponseTitle(e.target.value)}
                placeholder="Title"
              />
              <ZoruInput
                value={newResponseMessage}
                onChange={(e) => setNewResponseMessage(e.target.value)}
                placeholder="Message text"
              />
              <ZoruButton
                onClick={handleAddSavedResponse}
                disabled={
                  isSaving || !newResponseTitle || !newResponseMessage
                }
              >
                <Plus /> Add response
              </ZoruButton>
            </div>
            <div className="mt-4">
              {savedResponses.length > 0 ? (
                <div className="rounded-[var(--zoru-radius)] border border-zoru-line">
                  <ZoruTable>
                    <ZoruTableHeader>
                      <ZoruTableRow>
                        <ZoruTableHead>Title</ZoruTableHead>
                        <ZoruTableHead>Message</ZoruTableHead>
                        <ZoruTableHead>Enabled</ZoruTableHead>
                        <ZoruTableHead className="w-12" />
                      </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                      {savedResponses.map((resp: any) => (
                        <ZoruTableRow key={resp.id}>
                          <ZoruTableCell className="text-sm text-zoru-ink">
                            {resp.title}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-sm text-zoru-ink-muted line-clamp-1">
                            {resp.message}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {resp.is_enabled ? (
                              <CheckCircle className="h-4 w-4 text-zoru-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-zoru-ink-muted" />
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruButton
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteResponse(resp.id)}
                              aria-label="Delete saved response"
                            >
                              <Trash2 />
                            </ZoruButton>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))}
                    </ZoruTableBody>
                  </ZoruTable>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-zoru-ink-muted">
                  No saved responses.
                </p>
              )}
            </div>
          </ZoruCard>

          {/* Feature review */}
          <ZoruCard className="p-5 md:col-span-2">
            <h2 className="text-[14px] text-zoru-ink">
              Messaging feature review
            </h2>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Status of each Messenger feature your page is approved for.
            </p>
            <div className="mt-4">
              {features.length > 0 ? (
                <div className="space-y-2">
                  {features.map((feature, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                    >
                      <span className="text-sm text-zoru-ink">
                        {feature.feature}
                      </span>
                      <ZoruBadge
                        variant={
                          feature.status === "approved"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {feature.status}
                      </ZoruBadge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-zoru-ink-muted">
                  No feature review data available.
                </p>
              )}
            </div>
          </ZoruCard>
        </div>
      )}
    </div>
  );
}
