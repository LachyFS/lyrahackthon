"use client";

import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/app-layout";

export default function AnalyzeLoading() {
  return (
    <AppLayout>
      <div className="flex-1 bg-background overflow-auto">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute inset-0 noise-overlay pointer-events-none" />

        <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
          <p className="text-lg text-muted-foreground">Analyzing GitHub profile...</p>
          <p className="text-sm text-muted-foreground">Fetching repos, analyzing activity patterns...</p>
        </main>
      </div>
    </AppLayout>
  );
}
