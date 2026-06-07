"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Button, IconButton, Input, toast } from "@/components/sabcrm/20ui";

export function ApplyForm({ jobId, jobTitle }: { jobId: string, jobTitle: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<{prompt: string, answer: string}[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { key: "name", prompt: `> Enter full_name:` },
    { key: "email", prompt: "> Enter email:" },
    { key: "portfolio", prompt: "> Enter portfolio_url | github_url:" },
    { key: "coverLetter", prompt: "> Enter cover_letter (optional):" },
  ];

  const formData = useRef<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, step]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const currentStepKey = steps[step].key;
      formData.current[currentStepKey] = currentInput;

      setHistory([...history, { prompt: steps[step].prompt, answer: currentInput }]);
      setCurrentInput("");

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        submitForm();
      }
    }
  };

  const resetForm = () => {
    setIsOpen(false);
    setStep(0);
    setHistory([]);
    formData.current = {};
  };

  const submitForm = () => {
    setIsSubmitting(true);

    // Construct mailto link
    const subject = encodeURIComponent(`Application: ${jobTitle} (${jobId})`);
    const body = encodeURIComponent(
      `Name: ${formData.current.name}\n` +
      `Email: ${formData.current.email}\n` +
      `Portfolio/GitHub: ${formData.current.portfolio}\n` +
      `Cover Letter:\n${formData.current.coverLetter}\n`
    );

    setTimeout(() => {
      window.location.href = `mailto:careers@sabnode.in?subject=${subject}&body=${body}`;

      setIsSubmitting(false);
      setIsOpen(false);
      toast.success({
        title: "Application successfully compiled [200 OK]",
        description: `Mail client opened for ${jobTitle}`,
      });

      // Reset form
      setStep(0);
      setHistory([]);
      formData.current = {};
    }, 800);
  };

  if (!isOpen) {
    return (
      <div className="ui20">
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          className="w-full uppercase tracking-wider sm:w-auto"
        >
          Execute / Apply
        </Button>
      </div>
    );
  }

  return (
    <div className="ui20 mt-6 animate-in fade-in slide-in-from-top-2 border-t border-[var(--st-border)] pt-6">
      <div
        className="min-h-[250px] cursor-text rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 font-mono text-sm text-[var(--st-text)]"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[var(--st-border)] pb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--st-text-secondary)]">Terminal - SabNode Careers</span>
          <IconButton
            label="Abort application"
            icon={X}
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              resetForm();
            }}
          />
        </div>

        <div className="mb-2 space-y-2">
          <div className="text-[var(--st-text-tertiary)]">$ ./apply.sh --job {jobId}</div>
          <div className="text-[var(--st-text-tertiary)]">Initializing application process...</div>
          <div className="text-[var(--st-text-tertiary)]">Follow the prompts to construct the payload.</div>
          <br/>

          {history.map((h, i) => (
            <div key={i} className="mb-2">
              <div className="text-[var(--st-text-secondary)]">{h.prompt}</div>
              <div className="text-[var(--st-text)]">{h.answer}</div>
            </div>
          ))}

          {step < steps.length && !isSubmitting && (
            <div className="animate-in fade-in">
              <div className="text-[var(--st-text-secondary)]">{steps[step].prompt}</div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--st-text-tertiary)]" aria-hidden="true">{"~"}</span>
                <Input
                  ref={inputRef}
                  type="text"
                  aria-label={steps[step].prompt}
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="!h-auto flex-1 !border-none !bg-transparent !px-0 !shadow-none focus:!shadow-none"
                  placeholder="Type and press Enter..."
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {isSubmitting && (
            <div className="mt-4 animate-pulse text-[var(--st-text)]">
              Compiling payload and transferring control to local mail client...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
