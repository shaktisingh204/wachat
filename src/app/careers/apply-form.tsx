"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { toast } from "sonner";

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
      toast.success("Application successfully compiled [200 OK]", {
        description: `Mail client opened for ${jobTitle}`
      });
      
      // Reset form
      setStep(0);
      setHistory([]);
      formData.current = {};
    }, 800);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto bg-white text-black hover:bg-black hover:text-white hover:border-white border border-transparent transition-colors px-6 py-2 text-sm font-bold uppercase tracking-wider"
      >
        Execute / Apply
      </button>
    );
  }

  return (
    <div 
      className="border-t border-white pt-6 mt-6 animate-in fade-in slide-in-from-top-2"
    >
      <div 
        className="border border-white p-4 bg-black text-white font-mono text-sm cursor-text min-h-[250px]"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex justify-between items-center border-b border-white/50 pb-2 mb-4">
          <span className="uppercase tracking-widest font-bold text-xs">Terminal - SabNode Careers</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              setStep(0);
              setHistory([]);
              formData.current = {};
            }}
            className="text-xs hover:bg-white hover:text-black border border-transparent hover:border-white px-2 py-0.5 transition-colors"
          >
            [X] ABORT
          </button>
        </div>

        <div className="space-y-2 mb-2">
          <div className="text-white/50">$ ./apply.sh --job {jobId}</div>
          <div className="text-white/50">Initializing application process...</div>
          <div className="text-white/50">Follow the prompts to construct the payload.</div>
          <br/>
          
          {history.map((h, i) => (
            <div key={i} className="mb-2">
              <div className="text-white/70">{h.prompt}</div>
              <div className="text-white">{h.answer}</div>
            </div>
          ))}

          {step < steps.length && !isSubmitting && (
            <div className="animate-in fade-in">
              <div className="text-white/70">{steps[step].prompt}</div>
              <div className="flex items-center gap-2">
                <span className="text-white/50">{"~"}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-white/20"
                  placeholder="Type and press Enter..."
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {isSubmitting && (
            <div className="text-white animate-pulse mt-4">
              Compiling payload and transferring control to local mail client...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
