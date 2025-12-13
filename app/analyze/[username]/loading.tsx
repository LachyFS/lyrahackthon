import Link from "next/link";
import { BarChart3, Loader2 } from "lucide-react";

export default function AnalyzeLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              GitSignal
            </span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
          <p className="text-lg text-muted-foreground">Analyzing GitHub profile...</p>
          <p className="text-sm text-muted-foreground">Fetching repos, analyzing activity patterns...</p>
        </div>
      </main>
    </div>
  );
}
