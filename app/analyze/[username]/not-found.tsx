import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3, UserX, ArrowLeft } from "lucide-react";
import { SearchForm } from "@/components/search-form";

export default function NotFound() {
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <UserX className="h-10 w-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">User Not Found</h1>
            <p className="text-muted-foreground max-w-md">
              We couldn&apos;t find a GitHub user with that username. Please check the spelling and try again.
            </p>
          </div>
          <div className="w-full max-w-md">
            <SearchForm />
          </div>
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
