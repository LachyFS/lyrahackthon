import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { analyzeGitHubProfile, type AnalysisResult } from "@/lib/actions/github-analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  ArrowLeft,
  MapPin,
  Building2,
  Link as LinkIcon,
  Calendar,
  GitFork,
  Star,
  Users,
  TrendingUp,
  Code2,
  GitCommit,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Brain,
  Loader2,
} from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { AISummary } from "@/components/ai-summary";

interface PageProps {
  params: Promise<{ username: string }>;
}

function AnalysisSkeleton() {
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
          <p className="text-sm text-muted-foreground">This may take a few seconds</p>
        </div>
      </main>
    </div>
  );
}

function getActivityColor(level: AnalysisResult["analysis"]["activityLevel"]) {
  switch (level) {
    case "very_active":
      return "text-emerald-400";
    case "active":
      return "text-green-400";
    case "moderate":
      return "text-yellow-400";
    case "low":
      return "text-orange-400";
    case "inactive":
      return "text-red-400";
  }
}

function getActivityLabel(level: AnalysisResult["analysis"]["activityLevel"]) {
  switch (level) {
    case "very_active":
      return "Very Active";
    case "active":
      return "Active";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    case "inactive":
      return "Inactive";
  }
}

function getRecommendationBadge(recommendation: AnalysisResult["analysis"]["recommendation"]) {
  switch (recommendation) {
    case "strong":
      return { label: "Strong Candidate", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };
    case "good":
      return { label: "Good Candidate", className: "bg-green-500/20 text-green-300 border-green-500/30" };
    case "moderate":
      return { label: "Moderate Candidate", className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
    case "weak":
      return { label: "Needs Review", className: "bg-red-500/20 text-red-300 border-red-500/30" };
  }
}

async function AnalysisContent({ username }: { username: string }) {
  let result: AnalysisResult;

  try {
    result = await analyzeGitHubProfile(username);
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      notFound();
    }
    throw error;
  }

  const { profile, analysis } = result;
  const badge = getRecommendationBadge(analysis.recommendation);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Background orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/10 blur-3xl" />
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
          <div className="hidden md:block w-96">
            <SearchForm />
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 md:px-6 py-8">
        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to search
        </Link>

        {/* Profile Header */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <img
                src={profile.avatar_url}
                alt={profile.login}
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border border-white/10"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    {profile.name || profile.login}
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </h1>
                  <a
                    href={`https://github.com/${profile.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-emerald-400 transition-colors"
                  >
                    @{profile.login}
                  </a>
                  {profile.bio && (
                    <p className="mt-2 text-muted-foreground max-w-2xl">{profile.bio}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{analysis.overallScore}</div>
                    <div className="text-xs text-muted-foreground">Signal Score</div>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                {profile.company && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {profile.company}
                  </div>
                )}
                {profile.blog && (
                  <a
                    href={profile.blog.startsWith("http") ? profile.blog : `https://${profile.blog}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Website
                  </a>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Public Repos", value: profile.public_repos, icon: Code2 },
            { label: "Total Stars", value: analysis.totalStars, icon: Star },
            { label: "Followers", value: profile.followers, icon: Users },
            { label: "Following", value: profile.following, icon: TrendingUp },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center"
            >
              <stat.icon className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - AI Summary & Key Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            <AISummary analysis={analysis} profile={profile} />

            {/* Activity & Experience */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                Activity & Experience
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Activity Level</span>
                    <span className={`text-sm font-medium ${getActivityColor(analysis.activityLevel)}`}>
                      {getActivityLabel(analysis.activityLevel)}
                    </span>
                  </div>
                  <Progress
                    value={
                      { very_active: 100, active: 80, moderate: 60, low: 40, inactive: 20 }[analysis.activityLevel]
                    }
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Est. Experience</span>
                    <span className="text-sm font-medium text-white">{analysis.estimatedExperience}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Account age: {analysis.accountAge} years
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Last activity: {analysis.lastActivityDays === 0 ? "Today" : analysis.lastActivityDays === -1 ? "Unknown" : `${analysis.lastActivityDays} days ago`}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <GitCommit className="h-4 w-4" />
                  {analysis.contributionPattern}
                </div>
              </div>
            </div>

            {/* Top Repositories */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                Top Repositories
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {analysis.topRepos.map((repo) => (
                  <a
                    key={repo.id}
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-white truncate">{repo.name}</h3>
                      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {repo.forks_count}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Languages, Strengths, Concerns */}
          <div className="space-y-6">
            {/* Languages */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                Languages
              </h2>
              <div className="space-y-3">
                {analysis.languages.slice(0, 6).map((lang) => (
                  <div key={lang.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white">{lang.name}</span>
                      <span className="text-muted-foreground">{lang.percentage}%</span>
                    </div>
                    <Progress value={lang.percentage} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Strengths
                </h2>
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {analysis.concerns.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  Things to Consider
                </h2>
                <ul className="space-y-2">
                  {analysis.concerns.map((concern, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics */}
            {analysis.topTopics.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-semibold mb-4">Top Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {analysis.topTopics.map((topic) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="border-white/10 bg-white/5"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* View on GitHub */}
            <Button asChild className="w-full" variant="outline">
              <a
                href={`https://github.com/${profile.login}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Full Profile on GitHub
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
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

export default async function AnalyzePage({ params }: PageProps) {
  const { username } = await params;

  return (
    <Suspense fallback={<AnalysisSkeleton />}>
      <AnalysisContent username={decodeURIComponent(username)} />
    </Suspense>
  );
}
