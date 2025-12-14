"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GithubIcon, ArrowLeft, ExternalLink, LogOut } from "lucide-react";
import { GitRadarLogoWave, GitRoastLogo } from "@/components/gitradar-logo";
import { signInWithGitHub, signOut } from "@/lib/actions/auth";
import { ReactNode } from "react";
import { User } from "@supabase/supabase-js";

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
  /** Whether to show the sign in button (only shown if user is not logged in) */
  showSignIn?: boolean;
  /** The currently authenticated user */
  user?: User | null;
  /** Custom right side content */
  rightContent?: ReactNode;
  /** Whether to use compact height (h-14 vs h-16) */
  compact?: boolean;
  /** Whether roast mode is enabled */
  roastMode?: boolean;
}

export function SiteHeader({
  navLinks,
  backLink,
  rightLabel,
  externalLink,
  showSignIn = false,
  user,
  rightContent,
  compact = false,
  roastMode = false,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className={`container mx-auto flex ${compact ? "h-14" : "h-16"} items-center justify-between px-4 md:px-6`}>
        {/* Left side: Logo and optional back link */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <div className="relative">
              {roastMode ? (
                <GitRoastLogo className="h-7 w-7 transition-transform group-hover:scale-110" />
              ) : (
                <GitRadarLogoWave className="h-7 w-7 transition-transform group-hover:scale-110" />
              )}
              <div className={`absolute inset-0 blur-lg opacity-0 group-hover:opacity-100 transition-opacity ${roastMode ? 'bg-red-500/50' : 'bg-emerald-400/50'}`} />
            </div>
            <span className={`bg-clip-text text-transparent ${roastMode ? 'bg-gradient-to-r from-red-400 to-orange-400' : 'bg-gradient-to-r from-white to-white/70'}`}>
              {roastMode ? 'Git Roast' : 'Git Radar'}
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

          {showSignIn && !user && (
            <form action={signInWithGitHub}>
              <Button className="bg-white text-black hover:bg-white/90 font-medium">
                <GithubIcon className="mr-2 h-4 w-4" />
                Sign in
              </Button>
            </form>
          )}

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.user_metadata?.avatar_url && (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata?.user_name || "User"}
                    className="h-8 w-8 rounded-full border border-white/10"
                  />
                )}
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.user_metadata?.user_name || user.email}
                </span>
              </div>
              <form action={signOut}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}

          {rightContent}
        </div>
      </div>
    </header>
  );
}
