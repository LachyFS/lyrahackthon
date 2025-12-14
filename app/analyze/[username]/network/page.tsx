import { Suspense } from "react";
import { notFound } from "next/navigation";
import { analyzeGitHubProfile } from "@/lib/actions/github-analyze";
import { getUser } from "@/lib/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  GitFork,
  Star,
  MapPin,
  Calendar,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { ExpandedCollaborationGraph } from "@/components/expanded-collaboration-graph";
import { SiteHeader } from "@/components/site-header";

interface PageProps {
  params: Promise<{ username: string }>;
}

function NetworkSkeleton() {
  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Header skeleton */}
      <SiteHeader compact rightLabel="Collaboration Network" />

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
        <p className="text-lg text-muted-foreground">Loading collaboration network...</p>
      </div>
    </div>
  );
}

async function NetworkContent({ username }: { username: string }) {
  const [result, user] = await Promise.all([
    analyzeGitHubProfile(username).catch((error) => {
      if (error instanceof Error && error.message === "User not found") {
        notFound();
      }
      throw error;
    }),
    getUser(),
  ]);

  const { profile, collaboration, analysis } = result;

  // Count contributors and repos
  const contributorCount = collaboration.collaborators.filter(c => c.type === "contributor").length;
  const repoCount = collaboration.repos.length;
  const orgCount = collaboration.organizations.length;

  // Format account age
  const accountAge = analysis.accountAge;
  const accountAgeText = accountAge >= 1 ? `${Math.floor(accountAge)} years` : `${Math.round(accountAge * 12)} months`;

  return (
    <div className="h-screen w-screen bg-background overflow-hidden relative flex flex-col">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Background orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Main Header */}
      <SiteHeader
        compact
        backLink={{ href: `/analyze/${username}`, label: "Back to analysis" }}
        rightLabel="Collaboration Network"
        externalLink={{ href: `https://github.com/${profile.login}`, label: "GitHub" }}
        showSignIn
        user={user}
      />

      {/* Floating Side Panel */}
      <div className="absolute top-[4.5rem] left-4 z-50 w-80 max-h-[calc(100vh-5.5rem)] overflow-y-auto custom-scrollbar">
        <div className="rounded-2xl border border-white/10 bg-background/90 backdrop-blur-xl shadow-2xl">
          {/* User Profile */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-start gap-3">
              <img
                src={profile.avatar_url}
                alt={profile.login}
                className="w-14 h-14 rounded-xl border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-white truncate">
                  {profile.name || profile.login}
                </h1>
                <p className="text-sm text-muted-foreground">@{profile.login}</p>
                {profile.bio && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="p-4 border-b border-white/5 space-y-2">
            {profile.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{profile.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>On GitHub for {accountAgeText}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-white font-medium">{profile.followers.toLocaleString()}</span>
              <span className="text-muted-foreground">followers</span>
              <span className="text-white font-medium">{profile.following.toLocaleString()}</span>
              <span className="text-muted-foreground">following</span>
            </div>
          </div>

          {/* Network Stats */}
          <div className="p-4 border-b border-white/5">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Network Overview
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <GitFork className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{repoCount}</div>
                <div className="text-[10px] text-muted-foreground">Repos</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <Users className="h-4 w-4 text-cyan-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{contributorCount}</div>
                <div className="text-[10px] text-muted-foreground">Contributors</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <Building2 className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{orgCount}</div>
                <div className="text-[10px] text-muted-foreground">Orgs</div>
              </div>
            </div>
          </div>

          {/* Top Languages */}
          {analysis.languages.length > 0 && (
            <div className="p-4 border-b border-white/5">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Top Languages
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {analysis.languages.slice(0, 5).map((lang) => (
                  <Badge
                    key={lang.name}
                    variant="outline"
                    className="text-xs border-white/10 bg-white/[0.02]"
                  >
                    {lang.name}
                    <span className="ml-1 text-muted-foreground">{lang.percentage}%</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Organizations */}
          {collaboration.organizations.length > 0 && (
            <div className="p-4 border-b border-white/5">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Organizations
              </h2>
              <div className="flex flex-wrap gap-2">
                {collaboration.organizations.slice(0, 6).map((org) => (
                  <a
                    key={org.login}
                    href={`https://github.com/${org.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                    title={org.login}
                  >
                    <img
                      src={org.avatar_url}
                      alt={org.login}
                      className="w-8 h-8 rounded-lg border border-purple-500/30 transition-all group-hover:border-purple-400 group-hover:scale-110"
                    />
                  </a>
                ))}
                {collaboration.organizations.length > 6 && (
                  <div className="w-8 h-8 rounded-lg border border-purple-500/20 bg-purple-500/10 flex items-center justify-center text-xs text-purple-300">
                    +{collaboration.organizations.length - 6}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top Repos */}
          {analysis.topRepos.length > 0 && (
            <div className="p-4">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Top Repositories
              </h2>
              <div className="space-y-2">
                {analysis.topRepos.slice(0, 4).map((repo) => (
                  <a
                    key={repo.id}
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{repo.name}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        <Star className="h-3 w-3 text-yellow-400" />
                        {repo.stargazers_count}
                      </div>
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{repo.description}</p>
                    )}
                    {repo.language && (
                      <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                        {repo.language}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* View on GitHub button */}
          <div className="p-4 pt-0">
            <Button variant="outline" className="w-full" asChild>
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
        </div>
      </div>

      {/* Full-screen Graph */}
      <div className="flex-1 relative z-10">
        <ExpandedCollaborationGraph profile={profile} collaboration={collaboration} fullscreen />
      </div>
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
