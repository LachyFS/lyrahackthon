import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeGitHubProfile } from "@/lib/actions/github-analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ArrowLeft,
  Users,
  Building2,
  GitFork,
  UserPlus,
  UserCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { ExpandedCollaborationGraph } from "@/components/expanded-collaboration-graph";

interface PageProps {
  params: Promise<{ username: string }>;
}

function NetworkSkeleton() {
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
          <p className="text-lg text-muted-foreground">Loading collaboration network...</p>
        </div>
      </main>
    </div>
  );
}

async function NetworkContent({ username }: { username: string }) {
  let result;

  try {
    result = await analyzeGitHubProfile(username);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      notFound();
    }
    throw error;
  }

  const { profile, collaboration } = result;

  // Count by type
  const orgCount = collaboration.collaborators.filter(c => c.type === "org").length;
  const contributorCount = collaboration.collaborators.filter(c => c.type === "contributor").length;
  const followingCount = collaboration.collaborators.filter(c => c.type === "following").length;
  const followerCount = collaboration.collaborators.filter(c => c.type === "follower").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Background orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-3xl" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <div className="relative">
              <BarChart3 className="h-6 w-6 text-emerald-400 transition-transform group-hover:scale-110" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              GitSignal
            </span>
          </Link>
          <Button variant="outline" asChild>
            <a
              href={`https://github.com/${profile.login}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 md:px-6 py-8">
        {/* Back button */}
        <Link
          href={`/analyze/${username}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile analysis
        </Link>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <img
              src={profile.avatar_url}
              alt={profile.login}
              className="w-16 h-16 rounded-xl border border-white/10"
            />
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-400" />
                Collaboration Network
              </h1>
              <p className="text-muted-foreground">
                @{profile.login}&apos;s professional connections on GitHub
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <Building2 className="h-5 w-5 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{orgCount}</div>
            <div className="text-xs text-muted-foreground">Organizations</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <GitFork className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{contributorCount}</div>
            <div className="text-xs text-muted-foreground">Co-Contributors</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <UserPlus className="h-5 w-5 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{followingCount}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <UserCheck className="h-5 w-5 text-gray-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{followerCount}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
        </div>

        {/* Full-page Graph */}
        <ExpandedCollaborationGraph profile={profile} collaboration={collaboration} />

        {/* Connection List */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold mb-4">All Connections</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collaboration.collaborators.map((collab) => (
              <a
                key={collab.login}
                href={`https://github.com/${collab.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
              >
                <img
                  src={collab.avatar_url}
                  alt={collab.login}
                  className="w-10 h-10 rounded-full border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{collab.login}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {collab.relationship}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    collab.type === "org"
                      ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      : collab.type === "contributor"
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                      : collab.type === "following"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "border-gray-500/30 bg-gray-500/10 text-gray-300"
                  }
                >
                  {collab.type === "org"
                    ? "Org"
                    : collab.type === "contributor"
                    ? "Contributor"
                    : collab.type === "following"
                    ? "Following"
                    : "Follower"}
                </Badge>
              </a>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              <span>GitSignal</span>
              <span className="mx-2">·</span>
              <span>Developer insights for hiring managers</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default async function NetworkPage({ params }: PageProps) {
  const { username } = await params;

  return (
    <Suspense fallback={<NetworkSkeleton />}>
      <NetworkContent username={decodeURIComponent(username)} />
    </Suspense>
  );
}
