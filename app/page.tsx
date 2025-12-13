import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signInWithGitHub } from "@/lib/actions/auth";
import {
  Code2,
  GithubIcon,
  Users,
  Zap,
  Terminal,
  GitBranch,
  Star,
  ArrowRight,
  Sparkles,
  Globe,
  Rocket,
  Command,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 grid-bg" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Animated gradient orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/20 animate-pulse-glow blur-3xl" />
      <div className="fixed top-[20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 animate-pulse-glow blur-3xl delay-200" />
      <div className="fixed bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-emerald-500/15 animate-pulse-glow blur-3xl delay-400" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <div className="relative">
              <Code2 className="h-6 w-6 text-purple-400 transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 blur-lg bg-purple-400/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              DevShowcase
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-white transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </Link>
          </nav>

          <form action={signInWithGitHub}>
            <Button className="bg-white text-black hover:bg-white/90 font-medium">
              <GithubIcon className="mr-2 h-4 w-4" />
              Sign in
            </Button>
          </form>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="container px-4 md:px-6 pt-20 pb-32 md:pt-32 md:pb-40">
          <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
            {/* Badge */}
            <div className="animate-slide-up opacity-0">
              <Badge
                variant="outline"
                className="mb-6 px-4 py-1.5 border-purple-500/30 bg-purple-500/10 text-purple-300 backdrop-blur-sm"
              >
                <Sparkles className="mr-1.5 h-3 w-3" />
                Now in public beta
              </Badge>
            </div>

            {/* Main heading */}
            <h1 className="animate-slide-up opacity-0 delay-100 text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent">
                Show what you&apos;re
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient">
                building
              </span>
            </h1>

            {/* Subheading */}
            <p className="animate-slide-up opacity-0 delay-200 text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
              A visual social platform for software engineers. GitHub-native,
              project-focused, and less corporate than LinkedIn.
            </p>

            {/* CTA Buttons */}
            <div className="animate-slide-up opacity-0 delay-300 flex flex-col sm:flex-row gap-4">
              <form action={signInWithGitHub}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium px-8 h-12 glow-purple"
                >
                  <GithubIcon className="mr-2 h-5 w-5" />
                  Get started with GitHub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <Button
                variant="outline"
                size="lg"
                className="border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium px-8 h-12"
              >
                <Terminal className="mr-2 h-5 w-5" />
                See demo
              </Button>
            </div>

            {/* Terminal Preview */}
            <div className="animate-scale-in opacity-0 delay-400 mt-16 md:mt-20 w-full max-w-4xl">
              <div className="terminal-window rounded-xl overflow-hidden animate-float">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/20">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground font-mono">
                      ~/devshowcase
                    </span>
                  </div>
                </div>

                {/* Terminal content */}
                <div className="p-6 font-mono text-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">$</span>
                    <span className="text-white">git push origin main</span>
                  </div>
                  <div className="text-muted-foreground pl-4 space-y-1">
                    <p>Enumerating objects: 42, done.</p>
                    <p>Counting objects: 100% (42/42), done.</p>
                    <p className="text-emerald-400">
                      remote: Resolving deltas: 100% (18/18)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-emerald-400">$</span>
                    <span className="text-purple-400">devshowcase</span>
                    <span className="text-white">share --project awesome-app</span>
                  </div>
                  <div className="text-muted-foreground pl-4 space-y-1">
                    <p className="text-cyan-400">
                      Sharing project to your feed...
                    </p>
                    <p className="text-emerald-400">
                      Post created! 23 engineers notified.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-emerald-400">$</span>
                    <span className="animate-pulse">_</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y border-white/5 bg-white/[0.02] py-12">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "10K+", label: "Developers", icon: Users },
                { value: "50K+", label: "Projects shared", icon: Rocket },
                { value: "100K+", label: "Connections made", icon: Globe },
                { value: "4.9", label: "Developer rating", icon: Star },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center text-center animate-slide-up opacity-0"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <stat.icon className="h-5 w-5 text-purple-400 mb-2" />
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container px-4 md:px-6 py-24 md:py-32">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge
              variant="outline"
              className="mb-4 border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
            >
              Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for builders
            </h2>
            <p className="text-muted-foreground">
              Everything you need to showcase your work and connect with other
              developers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: GithubIcon,
                title: "GitHub Native",
                description:
                  "Connect your GitHub and we auto-generate your profile from repos, languages, and contributions.",
                gradient: "from-purple-500 to-pink-500",
              },
              {
                icon: Terminal,
                title: "Project-First Profiles",
                description:
                  "Your profile showcases actual work. Languages, contributions, and projects front and center.",
                gradient: "from-cyan-500 to-blue-500",
              },
              {
                icon: Users,
                title: "Find Collaborators",
                description:
                  "Flag posts when looking for help. Connect with engineers who share your interests.",
                gradient: "from-emerald-500 to-teal-500",
              },
              {
                icon: GitBranch,
                title: "Activity Feed",
                description:
                  "See what developers you follow are building. Discover trending projects in your stack.",
                gradient: "from-orange-500 to-amber-500",
              },
              {
                icon: Zap,
                title: "Quick Sharing",
                description:
                  "Post screenshots, demos, and repo links in seconds. Show your work, not your resume.",
                gradient: "from-pink-500 to-rose-500",
              },
              {
                icon: Command,
                title: "Stack Discovery",
                description:
                  "Find engineers by tech stack. Filter by language, framework, or tools they use.",
                gradient: "from-violet-500 to-purple-500",
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
          className="border-t border-white/5 bg-gradient-to-b from-transparent to-purple-950/20 py-24 md:py-32"
        >
          <div className="container px-4 md:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              >
                How it works
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get started in minutes
              </h2>
              <p className="text-muted-foreground">
                Three simple steps to start showcasing your work.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: "01",
                  title: "Connect GitHub",
                  description:
                    "Sign in with GitHub and we'll auto-generate your profile from your repos, languages, and activity.",
                  icon: GithubIcon,
                },
                {
                  step: "02",
                  title: "Share Projects",
                  description:
                    "Post what you're building with screenshots, demos, and repo links. Show your work visually.",
                  icon: Rocket,
                },
                {
                  step: "03",
                  title: "Connect & Collaborate",
                  description:
                    "Discover engineers by tech stack, follow interesting people, and find collaborators.",
                  icon: Users,
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
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">
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
        <section className="container px-4 md:px-6 py-24 md:py-32">
          <div className="relative max-w-4xl mx-auto">
            {/* Background glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-cyan-600/20 blur-3xl" />

            <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 md:p-12 text-center overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />

              <h2 className="relative text-3xl md:text-4xl font-bold mb-4">
                Ready to showcase your work?
              </h2>
              <p className="relative text-muted-foreground max-w-xl mx-auto mb-8">
                Join thousands of developers sharing their projects, getting
                feedback, and connecting with collaborators.
              </p>
              <form action={signInWithGitHub} className="relative">
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 font-medium px-8 h-12"
                >
                  <GithubIcon className="mr-2 h-5 w-5" />
                  Sign up with GitHub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Code2 className="h-4 w-4" />
              <span>DevShowcase</span>
              <span className="mx-2">·</span>
              <span>Made with love for developers</span>
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
