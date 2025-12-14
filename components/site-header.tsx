"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GithubIcon, ArrowLeft, ExternalLink } from "lucide-react";
import { GitSignalLogoWave } from "@/components/gitsignal-logo";
import { signInWithGitHub } from "@/lib/actions/auth";
import { ReactNode } from "react";

interface NavLink {
  href: string;
  label: string;
}

interface BackLink {
  href: string;
  label: string;
}

interface ExternalLinkAction {
  href: string;
  label: string;
}

interface SiteHeaderProps {
  /** Navigation links to show in the center (hidden on mobile) */
  navLinks?: NavLink[];
  /** Back link with arrow to show after the logo */
  backLink?: BackLink;
  /** Label to show on the right side */
  rightLabel?: string;
  /** External link button to show on the right */
  externalLink?: ExternalLinkAction;
  /** Whether to show the sign in button */
  showSignIn?: boolean;
  /** Custom right side content */
  rightContent?: ReactNode;
  /** Whether to use compact height (h-14 vs h-16) */
  compact?: boolean;
}

export function SiteHeader({
  navLinks,
  backLink,
  rightLabel,
  externalLink,
  showSignIn = false,
  rightContent,
  compact = false,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className={`container mx-auto flex ${compact ? "h-14" : "h-16"} items-center justify-between px-4 md:px-6`}>
        {/* Left side: Logo and optional back link */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <div className="relative">
              <GitSignalLogoWave className="h-7 w-7 transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 blur-lg bg-emerald-400/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              GitSignal
            </span>
          </Link>

          {backLink && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <Link
                href={backLink.href}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {backLink.label}
              </Link>
            </>
          )}
        </div>

        {/* Center: Navigation links */}
        {navLinks && navLinks.length > 0 && (
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Right side: Label, external link, sign in, or custom content */}
        <div className="flex items-center gap-3">
          {rightLabel && (
            <span className="text-sm text-muted-foreground">{rightLabel}</span>
          )}

          {externalLink && (
            <a
              href={externalLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {externalLink.label}
            </a>
          )}

          {showSignIn && (
            <form action={signInWithGitHub}>
              <Button className="bg-white text-black hover:bg-white/90 font-medium">
                <GithubIcon className="mr-2 h-4 w-4" />
                Sign in
              </Button>
            </form>
          )}

          {rightContent}
        </div>
      </div>
    </header>
  );
}
