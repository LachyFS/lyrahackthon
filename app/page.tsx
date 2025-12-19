import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signInWithGitHub, getUser } from "@/lib/actions/auth";
import {
  Search,
  GithubIcon,
  Users,
  Zap,
  BarChart3,
  Brain,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Code2,
  GitCommit,
} from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { GitRadarLogoWave } from "@/components/gitradar-logo";
import { SiteHeader } from "@/components/site-header";
import { QuickExamples } from "@/components/quick-examples";

export default async function Home() {
  const user = await getUser();

  return (
    <div className="relative mx-auto min-h-screen overflow-hidden bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Animated gradient orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-600/20 animate-pulse-glow blur-3xl" />
      <div className="fixed top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 animate-pulse-glow blur-3xl delay-200" />
      <div className="fixed bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-blue-500/15 animate-pulse-glow blur-3xl delay-400" />

      {/* Header */}
      <SiteHeader
        navLinks={[
          { href: "/ai-search", label: "AI Chat" },
          { href: "/sonar", label: "Sonar" },
          { href: "/ai-search?roast=true", label: "Roast" },
          { href: "#features", label: "Features" },
          { href: "#how-it-works", label: "How it works" },
        ]}
        showSignIn
        user={user}
      />

      <main className="relative z-10 mx-auto">
        {/* Hero Section */}
        <section className="container mx-auto px-4 md:px-6 pt-20 pb-32 md:pt-32 md:pb-40">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">

            {/* Main heading */}
            <h1 className="animate-slide-up opacity-0 delay-100 text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent">
                Find top developers
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                where the code lives
              </span>
            </h1>

            {/* Subheading */}
            <p className="animate-slide-up opacity-0 delay-200 text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
              AI-powered developer sourcing from GitHub. Chat with our AI to find candidates,
              get deep profile analysis, or set up Sonar to automatically discover matching talent.
            </p>

            {/* Search Form */}
            <div className="animate-slide-up opacity-0 delay-300 w-full max-w-2xl mb-8">
              <SearchForm isSignedIn={!!user} />
            </div>

            {/* Quick actions */}
            <QuickExamples isSignedIn={!!user} />

            {/* Preview Card */}
            <div className="animate-scale-in opacity-0 delay-500 mt-16 md:mt-20 w-full max-w-4xl">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] backdrop-blur-xl">
                {/* Card header */}
                <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                    JS
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">johndoe</h3>
                    <p className="text-sm text-muted-foreground">Full-Stack Developer · San Francisco</p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    Strong Candidate
                  </Badge>
                </div>

                {/* Card content */}
                <div className="p-6 space-y-6">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Experience", value: "5+ years", icon: TrendingUp },
                      { label: "Activity", value: "Very Active", icon: GitCommit },
                      { label: "Languages", value: "12", icon: Code2 },
                      { label: "Contributions", value: "2,340", icon: CheckCircle },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <stat.icon className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                        <div className="text-lg font-semibold text-white">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* AI Summary */}
                  <div className="rounded-lg bg-white/5 border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-medium text-cyan-400">AI Summary</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      This developer shows consistent coding activity over 5+ years, with strong expertise in
                      JavaScript/TypeScript and React. They contribute to both personal projects and open source,
                      indicating collaboration skills. Their code quality appears high based on project structure
                      and documentation practices.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 md:px-6 py-24 md:py-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge
              variant="outline"
              className="mb-4 border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
            >
              Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to source developers
            </h2>
            <p className="text-muted-foreground">
              From AI chat to automated searches, Git Radar gives you the tools to find and evaluate developers at scale.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "AI Chat Search",
                description:
                  "Describe who you're looking for in natural language. Our AI searches GitHub and ranks candidates for you.",
                gradient: "from-emerald-500 to-teal-500",
              },
              {
                icon: Search,
                title: "Sonar Auto-Search",
                description:
                  "Set up search briefs and let Sonar automatically find matching developers. Get notified when new talent appears.",
                gradient: "from-cyan-500 to-blue-500",
              },
              {
                icon: BarChart3,
                title: "Deep Profile Analysis",
                description:
                  "Get detailed breakdowns of any GitHub profile—languages, activity patterns, top repos, and AI-generated insights.",
                gradient: "from-blue-500 to-indigo-500",
              },
              {
                icon: Users,
                title: "Collaboration Networks",
                description:
                  "Visualize who developers work with. Discover hidden talent through collaboration graphs.",
                gradient: "from-purple-500 to-pink-500",
              },
              {
                icon: Code2,
                title: "Repository Analysis",
                description:
                  "Analyze any GitHub repo in depth. Understand code quality, architecture, and the tech stack used.",
                gradient: "from-pink-500 to-rose-500",
              },
              {
                icon: Zap,
                title: "Git Roast Mode",
                description:
                  "Have some fun—get a humorous roast of any developer's GitHub profile. Great for team building.",
                gradient: "from-orange-500 to-amber-500",
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all duration-300 hover:border-white/10 animate-slide-up opacity-0"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* How it works Section */}
        <section
          id="how-it-works"
          className="border-t border-white/5 bg-gradient-to-b from-transparent to-emerald-950/20 py-24 md:py-32"
        >
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                How it works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Three ways to find your next hire
              </h2>
              <p className="text-muted-foreground">
                Whether you need candidates now or want to build a pipeline, we&apos;ve got you covered.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Chat with AI",
                  description:
                    "Tell our AI what you're looking for—skills, location, experience. It searches GitHub and ranks the best matches.",
                  icon: Brain,
                },
                {
                  step: "02",
                  title: "Analyze Profiles",
                  description:
                    "Enter any GitHub username to get a deep analysis—languages, activity, top repos, collaboration network, and AI insights.",
                  icon: BarChart3,
                },
                {
                  step: "03",
                  title: "Set Up Sonar",
                  description:
                    "Create search briefs describing your ideal candidate. Sonar continuously finds new matching developers.",
                  icon: Search,
                },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className="relative animate-slide-up opacity-0"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {/* Connector line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/20 to-transparent" />
                  )}

                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-6">
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center">
                        <item.icon className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 md:px-6 py-24 md:py-32">
          <div className="relative max-w-4xl mx-auto">
            {/* Background glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-600/20 via-cyan-600/20 to-blue-600/20 blur-3xl" />

            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 md:p-12 text-center overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />

              <h2 className="relative text-3xl md:text-4xl font-bold mb-4">
                Stop searching job boards. Start finding real builders.
              </h2>
              <p className="relative text-muted-foreground max-w-xl mx-auto mb-8">
                Sign in with GitHub to unlock Sonar, save your searches, and get unlimited profile analyses.
              </p>
              <form action={signInWithGitHub} className="relative">
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 font-medium px-8 h-12"
                >
                  <GithubIcon className="mr-2 h-5 w-5" />
                  Sign in with GitHub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitRadarLogoWave className="h-5 w-5" />
              <span>Git Radar</span>
              <span className="mx-2">·</span>
              <span>Source developers from GitHub</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link
                href="https://github.com"
                className="hover:text-white transition-colors"
              >
                <GithubIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
