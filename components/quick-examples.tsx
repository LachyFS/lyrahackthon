"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, GithubIcon } from "lucide-react";
import { signInWithGitHub } from "@/lib/actions/auth";

interface QuickExamplesProps {
  isSignedIn: boolean;
}

export function QuickExamples({ isSignedIn }: QuickExamplesProps) {
  const router = useRouter();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  const handleExampleClick = (href: string) => {
    if (!isSignedIn) {
      setShowSignInPrompt(true);
      return;
    }
    router.push(href);
  };

  const examples = [
    {
      href: "/analyze/torvalds",
      label: "@torvalds",
      className: "px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors cursor-pointer",
    },
    {
      href: "/analyze/gaearon",
      label: "@gaearon",
      className: "px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors cursor-pointer",
    },
    {
      href: "/ai-search?q=Rust%20developers%20in%20Sydney",
      label: "Rust devs in Sydney",
      className: "px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors cursor-pointer",
    },
    {
      href: "/ai-search?roast=true",
      label: "Roast Mode",
      className: "px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer",
      icon: Flame,
    },
  ];

  return (
    <>
      <div className="animate-slide-up opacity-0 delay-400 flex flex-wrap justify-center gap-2 text-sm">
        {examples.map((example) => (
          <button
            key={example.href}
            onClick={() => handleExampleClick(example.href)}
            className={example.className}
          >
            {example.icon && <example.icon className="h-3.5 w-3.5" />}
            {example.label}
          </button>
        ))}
      </div>

      {/* Sign-in modal */}
      <Dialog open={showSignInPrompt} onOpenChange={setShowSignInPrompt}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-white/10">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Lock className="h-6 w-6 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl">Sign in to search</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Sign in with GitHub to search developers and access AI-powered analysis of any developer&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <form action={signInWithGitHub}>
              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-white/90 font-medium h-11"
              >
                <GithubIcon className="mr-2 h-5 w-5" />
                Sign in with GitHub
              </Button>
            </form>
            <p className="text-xs text-center text-muted-foreground">
              We only request read access to your public profile.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
