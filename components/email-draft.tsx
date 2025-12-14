"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Send,
  Copy,
  Check,
  User,
  Building2,
  ExternalLink,
} from "lucide-react";

interface EmailDraftData {
  candidateUsername: string;
  candidateName: string;
  candidateEmail: string | null;
  subject: string;
  body: string;
  role: string;
  companyName: string;
}

interface EmailDraftProps {
  data: EmailDraftData;
}

export function EmailDraft({ data }: EmailDraftProps) {
  const [to, setTo] = useState(data.candidateEmail || "");
  const [subject, setSubject] = useState(data.subject);
  const [body, setBody] = useState(data.body);
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = async () => {
    const fullEmail = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="p-2 rounded-full bg-emerald-500/20">
          <Mail className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white">Draft Email</h3>
          <p className="text-xs text-muted-foreground">
            Outreach to {data.candidateName} for {data.role}
          </p>
        </div>
        <a
          href={`https://github.com/${data.candidateUsername}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
        >
          <img
            src={`https://github.com/${data.candidateUsername}.png`}
            alt={data.candidateName}
            className="w-5 h-5 rounded-full"
          />
          @{data.candidateUsername}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Email Form */}
      <div className="p-4 space-y-4">
        {/* To Field */}
        <div className="space-y-1.5">
          <Label htmlFor="email-to" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <User className="h-3 w-3" />
            To
          </Label>
          <Input
            id="email-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Enter recipient email..."
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-emerald-500/50"
          />
          {!data.candidateEmail && (
            <p className="text-[10px] text-amber-400/80">
              Email not found on GitHub profile. Please enter manually.
            </p>
          )}
        </div>

        {/* Subject Field */}
        <div className="space-y-1.5">
          <Label htmlFor="email-subject" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3 w-3" />
            Subject
          </Label>
          <Input
            id="email-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-white/5 border-white/10 text-white focus:border-emerald-500/50"
          />
        </div>

        {/* Body Field */}
        <div className="space-y-1.5">
          <Label htmlFor="email-body" className="text-xs text-muted-foreground">
            Message
          </Label>
          <Textarea
            id="email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="bg-white/5 border-white/10 text-white focus:border-emerald-500/50 resize-none font-mono text-sm leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <a
            href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white transition-colors"
          >
            <Send className="h-4 w-4" />
            Open in Email Client
          </a>
          <Button
            variant="outline"
            onClick={handleCopyToClipboard}
            className="border-white/10 hover:bg-white/10 text-white"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Clicking &quot;Open in Email Client&quot; will open your default email application with this draft.
        </p>
      </div>
    </div>
  );
}
